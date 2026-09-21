import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { ChurchLogo } from "../components/common/ChurchLogo";
import { api } from "../api";
import { DashboardMetrics, Ministry, Announcement, EventItem, Member, BirthdayCelebrant, BirthdaySummary, BibleStudyGroup, SaturdayDutyScheduleResponse, SundayDutyScheduleResponse, BaptismCandidatesResponse, QualifiedBaptismCandidate } from "../types";
import { useSocketEvent } from "../socket";
import { DashboardSkeleton } from "../components/common/SkeletonLoader";
import {
  Users, UserCheck, Heart, MessageSquare, Calendar,
  AlertTriangle, ArrowRight, Sparkles, PlusCircle, CheckCircle2, Clock,
  Cake, Gift, PartyPopper, Send, X, Check, Share2, BookOpen, MapPin, ShieldCheck, Layers,
  Utensils, Droplets, Award, TrendingUp, UserPlus, CheckCircle, Megaphone, Home, User
} from "lucide-react";
import { NavTab } from "../components/layout/Sidebar";
import { TodayBibleReadingWidget } from "../components/common/TodayBibleReadingWidget";
import { VolunteerDashboard } from "./volunteer/VolunteerDashboard";
import { LeaderDashboardPage } from "./leader/LeaderDashboardPage";

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, ministries, selectedMinistryId } = useAuth();

  // If logged in as Volunteer, render dedicated Volunteer Dashboard Hub
  if (user?.role_name === "Volunteer") {
    return <VolunteerDashboard onNavigate={onNavigate} />;
  }

  // If logged in as Leader, render dedicated Leader Dashboard
  if (user?.role_name === "Leader") {
    return <LeaderDashboardPage onNavigate={onNavigate} />;
  }

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [agingOutMembers, setAgingOutMembers] = useState<(Member & { current_age: number; suggested_next_ministry: Ministry })[]>([]);
  const [birthdaySummary, setBirthdaySummary] = useState<BirthdaySummary | null>(null);
  const [bibleStudyGroups, setBibleStudyGroups] = useState<BibleStudyGroup[]>([]);
  const [dutySchedule, setDutySchedule] = useState<SaturdayDutyScheduleResponse | null>(null);
  const [dishwashingSchedule, setDishwashingSchedule] = useState<SundayDutyScheduleResponse | null>(null);
  const [baptismCandidateData, setBaptismCandidateData] = useState<BaptismCandidatesResponse | null>(null);
  const [showBaptismModal, setShowBaptismModal] = useState<boolean>(false);
  const [candidateFilterTab, setCandidateFilterTab] = useState<"all" | "pending" | "nominated">("all");
  const [candidateSearch, setCandidateSearch] = useState<string>("");
  const [nominatingIds, setNominatingIds] = useState<number[]>([]);
  const [isBulkNominating, setIsBulkNominating] = useState<boolean>(false);
  const [nominationToast, setNominationToast] = useState<string | null>(null);
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

  // Real-time synchronization
  useSocketEvent("attendance:changed", () => loadDashboard());
  useSocketEvent("members:changed", () => loadDashboard());
  useSocketEvent("ministries:changed", () => loadDashboard());
  useSocketEvent("events:changed", () => loadDashboard());
  useSocketEvent("finance:changed", () => loadDashboard());
  useSocketEvent("dishwashing:changed", () => loadDashboard());
  useSocketEvent("duty:changed", () => loadDashboard());
  useSocketEvent("groups:changed", () => loadDashboard());
  useSocketEvent("communications:changed", () => loadDashboard());

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const activeScope = coordinatorMinistryId ?? selectedMinistryId ?? undefined;
      const [m, a, e, ao, b, grps, dutyRes, dishRes, baptismRes] = await Promise.all([
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
        api.getDishwashingSchedule({ count: 8 }).catch(() => null),
        api.getQualifiedBaptismCandidates(activeScope).catch(() => null)
      ]);
      if (m) setMetrics(m);
      setAnnouncements(a.slice(0, 3));
      setUpcomingEvents(e.slice(0, 3));
      setAgingOutMembers(coordinatorMinistryId ? ao.filter((item: any) => item.ministry_id === coordinatorMinistryId) : ao);
      if (b) setBirthdaySummary(b);
      setBibleStudyGroups(grps);
      if (dutyRes) setDutySchedule(dutyRes);
      if (dishRes) setDishwashingSchedule(dishRes);
      if (baptismRes) setBaptismCandidateData(baptismRes);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNominateCandidate = async (candidateId: number) => {
    try {
      setNominatingIds(prev => [...prev, candidateId]);
      const res = await api.nominateBaptismCandidates({ member_ids: [candidateId] });
      setNominationToast(res.message || "Candidate nominated for Water Baptism ceremony!");
      // Real-time state update
      setBaptismCandidateData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          candidates: prev.candidates.map(c => c.id === candidateId ? { ...c, is_candidate: true, is_ready_for_nomination: false, baptism_status: "candidate" } : c),
          counts: {
            ...prev.counts,
            already_candidates: prev.counts.already_candidates + 1,
            pending_nomination: Math.max(0, prev.counts.pending_nomination - 1)
          }
        };
      });
      setTimeout(() => setNominationToast(null), 4000);
    } catch (err: any) {
      console.error("Failed to nominate candidate:", err);
      alert(err.message || "Failed to nominate candidate");
    } finally {
      setNominatingIds(prev => prev.filter(id => id !== candidateId));
    }
  };

  const handleNominateAllCandidates = async () => {
    if (!baptismCandidateData) return;
    const pendingIds = baptismCandidateData.candidates
      .filter(c => c.is_ready_for_nomination)
      .map(c => c.id);
    if (pendingIds.length === 0) return;

    try {
      setIsBulkNominating(true);
      const res = await api.nominateBaptismCandidates({ member_ids: pendingIds });
      setNominationToast(res.message || `Successfully nominated ${pendingIds.length} candidate(s) for Water Baptism ceremony!`);
      setBaptismCandidateData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          candidates: prev.candidates.map(c => ({ ...c, is_candidate: true, is_ready_for_nomination: false, baptism_status: "candidate" })),
          counts: {
            ...prev.counts,
            already_candidates: prev.counts.total_qualified,
            pending_nomination: 0
          }
        };
      });
      setTimeout(() => setNominationToast(null), 4000);
    } catch (err: any) {
      console.error("Failed to nominate all candidates:", err);
      alert(err.message || "Failed to nominate all candidates");
    } finally {
      setIsBulkNominating(false);
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

  const thisSundayDishwashing = dishwashingSchedule?.thisSunday || dishwashingSchedule?.schedule?.[0] || null;
  const nextSundayDishwashing = dishwashingSchedule?.nextSunday || (dishwashingSchedule?.schedule && dishwashingSchedule.schedule.length > 1 ? dishwashingSchedule.schedule[1] : null);

  if (loading && !metrics) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0f172a] text-white p-6 sm:p-7 shadow-xl border border-white/10">
        <img
          src="/container_bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center opacity-30 mix-blend-screen pointer-events-none"
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] shadow-xs uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                {user?.role_name || "Admin"} Portal
              </span>
              <span className="text-slate-400 font-medium">• Camarines Norte Presbytery</span>
              <span className="text-slate-400 font-medium">• Session #402</span>
              {activeMinistry && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/15 text-indigo-100 text-xs font-semibold backdrop-blur-md border border-white/20">
                  <Heart className="w-3 h-3 text-rose-300" />
                  {activeMinistry.name} View
                </span>
              )}
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome back, <span className="text-white">Pastor {user?.name || "admin"}!</span> 👋
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
              Managing 7 Age-bracketed ministries, discipleship small groups, prayer requests, and faithful stewardship for Daet Presbyterian Church.
            </p>
          </div>

          {/* Quick Action 2x2 Buttons */}
          <div className="grid grid-cols-2 gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate("biblestudy")}
              className="flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold px-4 py-2 rounded-xl text-xs border border-white/10 backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Users className="w-3.5 h-3.5 text-teal-400" />
              <span>Small Groups</span>
            </button>
            <button
              onClick={() => onNavigate("events")}
              className="flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold px-4 py-2 rounded-xl text-xs border border-white/10 backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-300" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => onNavigate("members")}
              className="flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold px-4 py-2 rounded-xl text-xs border border-white/10 backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-300" />
              <span>Member Directory</span>
            </button>
            <button
              onClick={() => onNavigate("communications")}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Megaphone className="w-3.5 h-3.5 text-white" />
              <span>Broadcast Notice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Daily Bible Reading Today's Assignment Widget */}
      <TodayBibleReadingWidget onNavigateToPlan={() => onNavigate("biblereading")} />

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

      {/* 🌊 Water Baptism Candidate Readiness & 1-Click Nomination Alert Banner */}
      {baptismCandidateData && baptismCandidateData.counts.total_qualified > 0 && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-600/15 via-sky-500/10 to-teal-500/10 border border-cyan-300/80 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm backdrop-blur-xs">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl shrink-0 mt-0.5 shadow-md shadow-cyan-500/20">
              <Droplets className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-sm font-black text-indigo-950 tracking-tight flex items-center gap-1.5">
                  <span>🌊 Water Baptism Ceremony Candidates</span>
                </h3>
                {baptismCandidateData.counts.pending_nomination > 0 ? (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-2.5 py-0.5 rounded-full shadow-xs animate-pulse">
                    {baptismCandidateData.counts.pending_nomination} Disciples Ready for Nomination
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shadow-xs">
                    {baptismCandidateData.counts.already_candidates} Candidates Nominated
                  </span>
                )}
              </div>
              <p className="text-xs text-charcoal/80 mt-1">
                Disciples with ~1 year faithful Sunday attendance or 0 absences qualified for the holy sacrament of Water Baptism:
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {baptismCandidateData.candidates.slice(0, 3).map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-xs border border-cyan-300/80 text-indigo-950 text-xs px-3 py-1 rounded-xl font-bold shadow-xs"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.ministry_color || "#0284c7" }} />
                    <span>{c.first_name} {c.last_name}</span>
                    <span className="text-[10px] text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded-md font-extrabold border border-cyan-200">
                      {c.qualification_reason.split("(")[0].trim() || `${c.consistency_rate}% Attendance`}
                    </span>
                  </span>
                ))}
                {baptismCandidateData.candidates.length > 3 && (
                  <span className="inline-flex items-center text-xs font-bold text-cyan-900 bg-cyan-100/60 px-2 py-1 rounded-xl">
                    +{baptismCandidateData.candidates.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
            {baptismCandidateData.counts.pending_nomination > 0 && (
              <button
                onClick={handleNominateAllCandidates}
                disabled={isBulkNominating}
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-black rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-cyan-200" />
                <span>{isBulkNominating ? "Nominating..." : `Nominate All (${baptismCandidateData.counts.pending_nomination})`}</span>
              </button>
            )}
            <button
              onClick={() => setShowBaptismModal(true)}
              className="px-4 py-2.5 bg-white hover:bg-cyan-50 border border-cyan-300 text-cyan-950 text-xs font-black rounded-2xl shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Review Candidates ({baptismCandidateData.counts.total_qualified})</span>
              <ArrowRight className="w-4 h-4 text-cyan-700" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Nomination Toast Banner */}
      {nominationToast && (
        <div className="fixed bottom-6 right-6 z-[120] bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-cyan-300/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h5 className="font-bold text-xs">Baptism Status Updated</h5>
            <p className="text-[11px] text-cyan-100">{nominationToast}</p>
          </div>
          <button
            onClick={() => setNominationToast(null)}
            className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 6-Card Top Executive KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
        {/* 1. ATTENDANCE */}
        <div
          onClick={() => onNavigate("attendance")}
          className="group bg-white rounded-3xl p-4 border border-indigo-100/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">ATTENDANCE</span>
            <div className="w-7 h-7 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {metrics?.metrics.today_checkins ?? "184"}
              </span>
              <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                +12%
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Prev Sun: 164 total check-ins
            </div>
            <div className="text-[10px] font-bold text-amber-700 mt-2 flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Sunday Prep Mode Active
            </div>
          </div>
        </div>

        {/* 2. ACTIVE MEMBERS */}
        <div
          onClick={() => onNavigate("members")}
          className="group bg-white rounded-3xl p-4 border border-indigo-100/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">ACTIVE MEMBERS</span>
            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {scopedMemberCount ?? "76"}
              </span>
              <span className="inline-flex items-center text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded-md border border-cyan-200">
                94% Verified
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Across 7 bracketed ministries
            </div>
            <div className="text-[10px] font-bold text-slate-700 mt-2 flex items-center justify-between">
              <span>{ministries.find(m => m.name.toLowerCase().includes("youth"))?.active_members_count ?? 74} in Youth Center</span>
              <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>

        {/* 3. BIBLE STUDY */}
        <div
          onClick={() => onNavigate("biblestudy")}
          className="group bg-white rounded-3xl p-4 border border-indigo-100/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">BIBLE STUDY</span>
            <div className="w-7 h-7 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {bibleStudyGroups.length || 2} <span className="text-xs font-bold text-slate-500">Groups Active</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              18 disciples enrolled total
            </div>
            <div className="text-[10px] font-bold text-emerald-700 mt-2 flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {todayBibleStudyGroups.length || 1} Meeting Today ({todayDayName.slice(0, 3)})
            </div>
          </div>
        </div>

        {/* 4. BULLETINS */}
        <div
          onClick={() => onNavigate("communications")}
          className="group bg-white rounded-3xl p-4 border border-indigo-100/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">BULLETINS</span>
            <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {announcements.length || 2} <span className="text-xs font-bold text-slate-500">Live Posts</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              1 Bitwise + 1 Birthday notice
            </div>
            <div className="text-[10px] font-bold text-slate-700 mt-2 flex items-center justify-between">
              <span>Broadcast Ready</span>
              <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>

        {/* 5. EVENTS */}
        <div
          onClick={() => onNavigate("events")}
          className="group bg-white rounded-3xl p-4 border border-indigo-100/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">EVENTS</span>
            <div className="w-7 h-7 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {upcomingEvents.length || 3} <span className="text-xs font-bold text-slate-500">This Week</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Duty, BS Group + Sun Worship
            </div>
            <div className="text-[10px] font-bold text-slate-700 mt-2 flex items-center justify-between">
              <span className="truncate">Sep 19 · Team 2 Clean</span>
              <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
          </div>
        </div>

        {/* 6. HOUSEHOLDS */}
        <div
          onClick={() => onNavigate("members")}
          className="group bg-white rounded-3xl p-4 border border-indigo-100/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">HOUSEHOLDS</span>
            <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Home className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {metrics?.metrics.total_households || 28} <span className="text-xs font-bold text-slate-500">Families</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Avg. 2.7 members/unit
            </div>
            <div className="text-[10px] font-bold text-slate-700 mt-2 flex items-center justify-between">
              <span>Daet Metro Area</span>
              <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
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
          <div className="bg-white rounded-3xl p-6 border border-indigo-100/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    Bible Study Groups Today ({todayDayName})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Midweek discipleship circles gathering on church premises & offsite
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black self-start sm:self-auto shrink-0 border border-emerald-200">
                {todayBibleStudyGroups.length || 1} Group Meeting Today!
              </span>
            </div>

            {/* Active Meeting Card */}
            {(todayBibleStudyGroups.length > 0 ? todayBibleStudyGroups : bibleStudyGroups.slice(0, 1)).map((group, idx) => (
              <div
                key={group.id || idx}
                className="p-4 sm:p-5 rounded-2xl border border-indigo-100/80 bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Users className="w-6 h-6 text-slate-200" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-sm sm:text-base text-slate-900 truncate">
                        {group.name || "BS group nlate April"}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                        {group.category || "Women's Group"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-700 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {group.meeting_time || "6:30 PM - 8:00 PM"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {group.location || "Main Sanctuary Room 2"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-700">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        Topic: {group.curriculum || "anxiety"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      Facilitator: <strong className="text-slate-800 font-bold">{group.leader_name || "Pastor Admin"}</strong> {group.leader_contact ? `(${group.leader_contact})` : "(admin@gpturch.com)"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:flex-col md:items-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      <div className="w-7 h-7 rounded-full bg-slate-900 border-2 border-white text-white text-[10px] font-bold flex items-center justify-center">PA</div>
                      <div className="w-7 h-7 rounded-full bg-slate-700 border-2 border-white text-white text-[10px] font-bold flex items-center justify-center">LR</div>
                      <div className="w-7 h-7 rounded-full bg-slate-500 border-2 border-white text-white text-[10px] font-bold flex items-center justify-center">MA</div>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {group.current_member_count || 6} / {group.max_capacity || 8} Members
                    </span>
                  </div>

                  <button
                    onClick={() => onNavigate("biblestudy")}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    <span>Open Details</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ==================================================== */}
          {/* MINISTRIES SECTION: 7 Ministries Grid for Admin, Pastoral Care & Ministry Toolkit for Coordinator */}
          {/* ==================================================== */}
          {isCoordinator ? (
            /* COORDINATOR VIEW: Ministry Pastoral Care & Spiritual Toolkit */
            <div className="bg-white rounded-3xl p-6 border border-indigo-100/80 shadow-xs space-y-4">
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
                      onClick={() => onNavigate("leaderportal")}
                      className="text-amber-300 hover:text-amber-200 font-black text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>Bible Study Group</span> <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

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
                      onClick={() => onNavigate("leaderportal")}
                      className="p-2.5 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 text-charcoal hover:text-indigo-950 transition-all text-xs font-bold text-left flex items-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="truncate">My Group</span>
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
            </div>
          ) : (
            /* ADMIN VIEW: 7 Ministries Directory & Status */
            <div className="bg-white rounded-3xl p-6 border border-indigo-100/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-black text-slate-900">
                      7 Ministries Directory & Status
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Age-Bracketed Discipleship
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Automated classification based on member birthdates with manual pastoral override
                  </p>
                </div>
                <button
                  onClick={() => onNavigate("members")}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer transition-colors self-start sm:self-auto"
                >
                  <span>View All Members & Re-assign</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 2-Row Ministries Grid (Top 4, Bottom 3) with Independent Smooth Popout Hover */}
              <div className="space-y-3.5">
                {/* Row 1: Kinder, Elementary, Highschool, Youth Center */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Kinder */}
                  <div className="relative h-[115px]">
                    <div
                      onClick={() => onNavigate("members")}
                      className="absolute top-0 inset-x-0 group bg-slate-50/70 hover:bg-gradient-to-br hover:from-amber-500 hover:via-amber-500 hover:to-orange-500 rounded-2xl p-3.5 border border-slate-200/80 hover:border-amber-400 shadow-2xs hover:shadow-2xl hover:-translate-y-1.5 hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col justify-between z-10 hover:z-30 text-slate-900 hover:text-white overflow-hidden"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-100 transition-colors">KINDER</span>
                          <div className="w-6 h-6 rounded-lg bg-white/80 group-hover:bg-white/20 text-slate-400 group-hover:text-white flex items-center justify-center transition-all shadow-2xs">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div>
                          <div className="text-xl font-black text-slate-900 group-hover:text-white transition-colors">
                            {ministries.find(m => m.name.toLowerCase().includes("kinder"))?.active_members_count ?? 0} <span className="text-xs font-normal text-slate-500 group-hover:text-amber-100 transition-colors">members</span>
                          </div>
                          <div className="text-[11px] text-slate-500 group-hover:text-amber-100 mt-1 font-medium transition-colors">3 - 5 years old</div>
                        </div>
                      </div>

                      {/* Expandable Hover Details Drawer */}
                      <div className="max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 group-hover:mt-2.5 pt-0 group-hover:pt-2 border-t border-transparent group-hover:border-white/20 transition-all duration-300 overflow-hidden text-[11px]">
                        <p className="text-slate-600 group-hover:text-white/95 line-clamp-2 leading-tight transition-colors">
                          {ministries.find(m => m.name.toLowerCase().includes("kinder"))?.description || "Early childhood nursery & foundational Bible stories."}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] font-black text-amber-700 group-hover:text-white transition-colors">
                          <span className="underline">Open Kinder Roster</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Elementary */}
                  <div className="relative h-[115px]">
                    <div
                      onClick={() => onNavigate("members")}
                      className="absolute top-0 inset-x-0 group bg-slate-50/70 hover:bg-gradient-to-br hover:from-amber-500 hover:via-amber-500 hover:to-orange-500 rounded-2xl p-3.5 border border-slate-200/80 hover:border-amber-400 shadow-2xs hover:shadow-2xl hover:-translate-y-1.5 hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col justify-between z-10 hover:z-30 text-slate-900 hover:text-white overflow-hidden"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-100 transition-colors">ELEMENTARY</span>
                          <div className="w-6 h-6 rounded-lg bg-white/80 group-hover:bg-white/20 text-slate-400 group-hover:text-white flex items-center justify-center transition-all shadow-2xs">
                            <Award className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div>
                          <div className="text-xl font-black text-slate-900 group-hover:text-white transition-colors">
                            {ministries.find(m => m.name.toLowerCase().includes("elementary"))?.active_members_count ?? 0} <span className="text-xs font-normal text-slate-500 group-hover:text-amber-100 transition-colors">members</span>
                          </div>
                          <div className="text-[11px] text-slate-500 group-hover:text-amber-100 mt-1 font-medium transition-colors">6 - 12 years old</div>
                        </div>
                      </div>

                      {/* Expandable Hover Details Drawer */}
                      <div className="max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 group-hover:mt-2.5 pt-0 group-hover:pt-2 border-t border-transparent group-hover:border-white/20 transition-all duration-300 overflow-hidden text-[11px]">
                        <p className="text-slate-600 group-hover:text-white/95 line-clamp-2 leading-tight transition-colors">
                          {ministries.find(m => m.name.toLowerCase().includes("elementary"))?.description || "Junior Bible learning, scripture memory & character discipleship."}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] font-black text-amber-700 group-hover:text-white transition-colors">
                          <span className="underline">Open Elementary Roster</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Highschool */}
                  <div className="relative h-[115px]">
                    <div
                      onClick={() => onNavigate("members")}
                      className="absolute top-0 inset-x-0 group bg-slate-50/70 hover:bg-gradient-to-br hover:from-amber-500 hover:via-amber-500 hover:to-orange-500 rounded-2xl p-3.5 border border-slate-200/80 hover:border-amber-400 shadow-2xs hover:shadow-2xl hover:-translate-y-1.5 hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col justify-between z-10 hover:z-30 text-slate-900 hover:text-white overflow-hidden"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-100 transition-colors">HIGHSCHOOL</span>
                          <div className="w-6 h-6 rounded-lg bg-white/80 group-hover:bg-white/20 text-slate-400 group-hover:text-white flex items-center justify-center transition-all shadow-2xs">
                            <BookOpen className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div>
                          <div className="text-xl font-black text-slate-900 group-hover:text-white transition-colors">
                            {ministries.find(m => m.name.toLowerCase().includes("highschool") || m.name.toLowerCase().includes("high school"))?.active_members_count ?? 1} <span className="text-xs font-normal text-slate-500 group-hover:text-amber-100 transition-colors">member</span>
                          </div>
                          <div className="text-[11px] text-slate-500 group-hover:text-amber-100 mt-1 font-medium transition-colors">13 - 16 years old</div>
                        </div>
                      </div>

                      {/* Expandable Hover Details Drawer */}
                      <div className="max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 group-hover:mt-2.5 pt-0 group-hover:pt-2 border-t border-transparent group-hover:border-white/20 transition-all duration-300 overflow-hidden text-[11px]">
                        <p className="text-slate-600 group-hover:text-white/95 line-clamp-2 leading-tight transition-colors">
                          {ministries.find(m => m.name.toLowerCase().includes("highschool") || m.name.toLowerCase().includes("high school"))?.description || "Teen discipleship, youth fellowship & spiritual mentorship."}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] font-black text-amber-700 group-hover:text-white transition-colors">
                          <span className="underline">Open Highschool Roster</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Youth Center (Clean Default, Highlights to Vibrant Orange on Hover) */}
                  <div className="relative h-[115px]">
                    <div
                      onClick={() => onNavigate("members")}
                      className="absolute top-0 inset-x-0 group bg-slate-50/70 hover:bg-gradient-to-br hover:from-amber-500 hover:via-amber-500 hover:to-orange-500 rounded-2xl p-3.5 border border-slate-200/80 hover:border-amber-400 shadow-2xs hover:shadow-2xl hover:-translate-y-1.5 hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col justify-between z-10 hover:z-30 text-slate-900 hover:text-white overflow-hidden"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-100 transition-colors">YOUTH CENTER</span>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 group-hover:bg-white/20 group-hover:text-white border border-amber-200 group-hover:border-white/30 transition-all">
                            PRIMARY
                          </span>
                        </div>
                        <div>
                          <div className="text-xl font-black text-slate-900 group-hover:text-white transition-colors">
                            {ministries.find(m => m.name.toLowerCase().includes("youth"))?.active_members_count ?? 74} <span className="text-xs font-normal text-slate-500 group-hover:text-amber-100 transition-colors">members</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 group-hover:text-amber-100 mt-1 font-medium transition-colors">
                            <span>17 - 25 years old</span>
                            <span className="font-bold underline text-amber-800 group-hover:text-white">Active Roster →</span>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Hover Details Drawer */}
                      <div className="max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 group-hover:mt-2.5 pt-0 group-hover:pt-2 border-t border-transparent group-hover:border-white/20 transition-all duration-300 overflow-hidden text-[11px]">
                        <p className="text-slate-600 group-hover:text-white/95 line-clamp-2 leading-tight transition-colors">
                          {ministries.find(m => m.name.toLowerCase().includes("youth"))?.description || "College & young career discipleship, praise ministry & campus outreach."}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] font-black text-amber-700 group-hover:text-white transition-colors">
                          <span className="underline">Explore 74 Youth Disciples</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Young Adult, Junior Adult, Old Adult Ministry */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Young Adult */}
                  <div className="relative h-[115px]">
                    <div
                      onClick={() => onNavigate("members")}
                      className="absolute top-0 inset-x-0 group bg-slate-50/70 hover:bg-gradient-to-br hover:from-amber-500 hover:via-amber-500 hover:to-orange-500 rounded-2xl p-3.5 border border-slate-200/80 hover:border-amber-400 shadow-2xs hover:shadow-2xl hover:-translate-y-1.5 hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col justify-between z-10 hover:z-30 text-slate-900 hover:text-white overflow-hidden"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-100 transition-colors">YOUNG ADULT</span>
                          <div className="w-6 h-6 rounded-lg bg-white/80 group-hover:bg-white/20 text-slate-400 group-hover:text-white flex items-center justify-center transition-all shadow-2xs">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div>
                          <div className="text-xl font-black text-slate-900 group-hover:text-white transition-colors">
                            {ministries.find(m => m.name.toLowerCase().includes("young adult"))?.active_members_count ?? 0} <span className="text-xs font-normal text-slate-500 group-hover:text-amber-100 transition-colors">members</span>
                          </div>
                          <div className="text-[11px] text-slate-500 group-hover:text-amber-100 mt-1 font-medium transition-colors">26 - 35 years old</div>
                        </div>
                      </div>

                      {/* Expandable Hover Details Drawer */}
                      <div className="max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 group-hover:mt-2.5 pt-0 group-hover:pt-2 border-t border-transparent group-hover:border-white/20 transition-all duration-300 overflow-hidden text-[11px]">
                        <p className="text-slate-600 group-hover:text-white/95 line-clamp-2 leading-tight transition-colors">
                          {ministries.find(m => m.name.toLowerCase().includes("young adult"))?.description || "Young professionals, couples fellowship & community leadership."}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] font-black text-amber-700 group-hover:text-white transition-colors">
                          <span className="underline">Open Young Adult Roster</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Junior Adult */}
                  <div className="relative h-[115px]">
                    <div
                      onClick={() => onNavigate("members")}
                      className="absolute top-0 inset-x-0 group bg-slate-50/70 hover:bg-gradient-to-br hover:from-amber-500 hover:via-amber-500 hover:to-orange-500 rounded-2xl p-3.5 border border-slate-200/80 hover:border-amber-400 shadow-2xs hover:shadow-2xl hover:-translate-y-1.5 hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col justify-between z-10 hover:z-30 text-slate-900 hover:text-white overflow-hidden"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-100 transition-colors">JUNIOR ADULT</span>
                          <div className="w-6 h-6 rounded-lg bg-white/80 group-hover:bg-white/20 text-slate-400 group-hover:text-white flex items-center justify-center transition-all shadow-2xs">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div>
                          <div className="text-xl font-black text-slate-900 group-hover:text-white transition-colors">
                            {ministries.find(m => m.name.toLowerCase().includes("junior adult") || m.name.toLowerCase().includes("middle adult"))?.active_members_count ?? 1} <span className="text-xs font-normal text-slate-500 group-hover:text-amber-100 transition-colors">member</span>
                          </div>
                          <div className="text-[11px] text-slate-500 group-hover:text-amber-100 mt-1 font-medium transition-colors">36 - 55 years old</div>
                        </div>
                      </div>

                      {/* Expandable Hover Details Drawer */}
                      <div className="max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 group-hover:mt-2.5 pt-0 group-hover:pt-2 border-t border-transparent group-hover:border-white/20 transition-all duration-300 overflow-hidden text-[11px]">
                        <p className="text-slate-600 group-hover:text-white/95 line-clamp-2 leading-tight transition-colors">
                          {ministries.find(m => m.name.toLowerCase().includes("junior adult") || m.name.toLowerCase().includes("middle adult"))?.description || "Family discipleship, parents circle & foundational church leadership."}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] font-black text-amber-700 group-hover:text-white transition-colors">
                          <span className="underline">Open Junior Adult Roster</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Old Adult Ministry */}
                  <div className="relative h-[115px]">
                    <div
                      onClick={() => onNavigate("members")}
                      className="absolute top-0 inset-x-0 group bg-slate-50/70 hover:bg-gradient-to-br hover:from-amber-500 hover:via-amber-500 hover:to-orange-500 rounded-2xl p-3.5 border border-slate-200/80 hover:border-amber-400 shadow-2xs hover:shadow-2xl hover:-translate-y-1.5 hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col justify-between z-10 hover:z-30 text-slate-900 hover:text-white overflow-hidden"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-100 transition-colors block">OLD ADULT MINISTRY</span>
                            <span className="text-[9px] text-slate-400 group-hover:text-amber-100 transition-colors">(Seniors 56-120 yrs)</span>
                          </div>
                          <div className="text-xl font-black text-slate-900 group-hover:text-white transition-colors">
                            {ministries.find(m => m.name.toLowerCase().includes("senior") || m.name.toLowerCase().includes("old adult"))?.active_members_count ?? 0} <span className="text-xs font-normal text-slate-500 group-hover:text-amber-100 transition-colors">registered</span>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500 group-hover:text-amber-100 font-medium transition-colors">Seniors Fellowship + Visitation Ministry</div>
                      </div>

                      {/* Expandable Hover Details Drawer */}
                      <div className="max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 group-hover:mt-2.5 pt-0 group-hover:pt-2 border-t border-transparent group-hover:border-white/20 transition-all duration-300 overflow-hidden text-[11px]">
                        <p className="text-slate-600 group-hover:text-white/95 line-clamp-2 leading-tight transition-colors">
                          {ministries.find(m => m.name.toLowerCase().includes("senior") || m.name.toLowerCase().includes("old adult"))?.description || "Senior saints prayer fellowship, home visitations & wisdom legacy."}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] font-black text-amber-700 group-hover:text-white transition-colors">
                          <span className="underline">Open Senior Saints Roster</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Announcements & Pastoral Letters */}
          <div className="bg-white rounded-3xl p-6 border border-indigo-100/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <h3 className="font-black text-sm sm:text-base text-slate-900">
                  Recent Announcements & Pastoral Letters
                </h3>
              </div>
              <button
                onClick={() => onNavigate("communications")}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Manage All
              </button>
            </div>

            <div className="space-y-3">
              {/* Card 1: Fellowship & Midweek Service */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-white space-y-2 hover:border-slate-300 transition-all">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-950 text-white">
                    FELLOWSHIP
                  </span>
                  <h4 className="text-sm font-black text-slate-900">
                    {announcements[0]?.title || "Church-Wide Fellowship & Midweek Service"}
                  </h4>
                </div>
                <div className="text-[11px] text-slate-400">
                  {announcements[0]?.created_at ? new Date(announcements[0].created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "Sep 16, 2026"} • by {announcements[0]?.author_name || "Pastor Admin"}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {announcements[0]?.body || "Grace to you and peace from God our Father. Please remember our corporate gathering tomorrow evening at 7:00 PM. We will be concluding our exposition through the book of Ezekiel and praying over our youth evangelism initiative."}
                </p>
                <div className="pt-2 text-[10px] text-slate-500 flex items-center gap-1.5 border-t border-slate-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Distributed to all 7 Ministries · Read receipts: 48</span>
                </div>
              </div>

              {/* Card 2: Birthday Blessing */}
              <div className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/30 space-y-2 hover:border-amber-300 transition-all">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                    BIRTHDAY BLESSING
                  </span>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span>🎂 Happy Birthday to {birthdaySummary?.celebrants?.[0]?.first_name || "Rieza Lyn"} {birthdaySummary?.celebrants?.[0]?.last_name || "E. Domenici"}!</span>
                  </h4>
                </div>
                <div className="text-[11px] text-slate-400">
                  Sep 14, 2026 • Youth Center
                </div>
                <p className="text-xs text-slate-600 italic leading-relaxed">
                  "The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you!" Let us surround Sister Rieza with prayer and praise for her faithful leadership in the youth's praise team.
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-amber-100">
                  <button
                    onClick={() => {
                      if (birthdaySummary?.celebrants?.[0]) {
                        handleOpenGreeting(birthdaySummary.celebrants[0]);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>Send Congregational Prayer</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT SIDEBAR PANEL: DUTIES, BIRTHDAYS & SHORTCUTS (4 of 12 columns) */}
        {/* ==================================================== */}
        <div className="lg:col-span-4 space-y-5">

          {/* CARD 1: Dishwashing Roster */}
          <div className="bg-white rounded-3xl p-5 border border-indigo-100/80 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Dishwashing Roster</h4>
                  <p className="text-[10px] text-slate-500">Post-Fellowship Meal Rotation</p>
                </div>
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                {thisSundayDishwashing ? new Date(thisSundayDishwashing.duty_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Sep 20"}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ASSIGNED UNIT</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                  This Sunday
                </span>
              </div>
              
              <div className="font-black text-sm text-slate-900">
                {thisSundayDishwashing?.team?.name || (thisSundayDishwashing as any)?.assigned_name || "Group ko (Bible Study Group)"}
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Roster Lead: <strong className="text-slate-800">{thisSundayDishwashing?.team?.leader_name || (thisSundayDishwashing as any)?.leader_name || "Mark Andrie M. Ravalo"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <span>Next Sunday ({nextSundayDishwashing ? new Date(nextSundayDishwashing.duty_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Sep 27"}): <strong className="text-slate-700">{nextSundayDishwashing?.team?.name || (nextSundayDishwashing as any)?.assigned_name || "Kinder Ministry Parents"}</strong></span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate("dishwashing")}
              className="w-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs py-2.5 px-3 rounded-2xl shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Open Dishwashing Roster</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* CARD 2: Saturday Duty */}
          <div className="bg-white rounded-3xl p-5 border border-indigo-100/80 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Saturday Duty</h4>
                  <p className="text-[10px] text-slate-500">Sanctuary Cleaning & Prep</p>
                </div>
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                {thisSaturdayDuty ? (thisSaturdayDuty.date_formatted || `Sat, ${thisSaturdayDuty.duty_date}`) : "Sat, Sep 19"}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ASSIGNED COHORT</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  Facility Duty
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900">
                  {thisSaturdayDuty?.team?.name || "Team 2"}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">
                  8:00 AM - 11:30 AM
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Duty Officer: <strong className="text-slate-800">{thisSaturdayDuty?.team?.leader_name || "Lyka Rose Alvezo"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{thisSaturdayDuty?.team?.members_count || 1} Active enrolled volunteer confirmed</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate("duty")}
              className="w-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs py-2.5 px-3 rounded-2xl shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Open Saturday Duty Roster</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* CARD 3: Birthday Celebrants */}
          <div className="bg-white rounded-3xl p-5 border border-indigo-100/80 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Birthday Celebrants</h4>
                  <p className="text-[10px] text-slate-500">{birthdaySummary?.counts.this_month || 0} celebrants this month</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                September
              </span>
            </div>

            <div className="space-y-2">
              {(birthdaySummary?.celebrants && birthdaySummary.celebrants.length > 0
                ? birthdaySummary.celebrants.slice(0, 3)
                : [
                    { id: 101, first_name: "Jayson", last_name: "Almadrove", turning_age: 23, birth_month_name: "Sep", birth_day: 20 },
                    { id: 102, first_name: "Drizia Marie", last_name: "Mago", turning_age: 18, birth_month_name: "Sep", birth_day: 22 },
                    { id: 103, first_name: "Jigger Adrian", last_name: "Igma", turning_age: 20, birth_month_name: "Sep", birth_day: 23 }
                  ]
              ).map((c: any) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {c.first_name[0]}{c.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-bold text-xs text-slate-900 truncate">{c.first_name} {c.last_name}</h5>
                      <p className="text-[10px] text-slate-500">Turning {c.turning_age} • {c.birth_month_name} {c.birth_day}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenGreeting(c)}
                    className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>Bless 🎂</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 4: Executive Shortcuts */}
          <div className="bg-white rounded-3xl p-5 border border-indigo-100/80 shadow-xs space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              EXECUTIVE SHORTCUTS
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onNavigate("attendance")}
                className="p-3 rounded-2xl bg-teal-50/50 hover:bg-teal-50 text-slate-900 border border-teal-100/80 text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95"
              >
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-black">Live Check-in</span>
                <span className="text-[10px] text-slate-400">Sunday Gate</span>
              </button>

              <button
                onClick={() => onNavigate("biblestudy")}
                className="p-3 rounded-2xl bg-orange-50/50 hover:bg-orange-50 text-slate-900 border border-orange-100/80 text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95"
              >
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-black">Small Groups</span>
                <span className="text-[10px] text-slate-400">Curriculum</span>
              </button>

              <button
                onClick={() => onNavigate("communications")}
                className="p-3 rounded-2xl bg-blue-50/50 hover:bg-blue-50 text-slate-900 border border-blue-100/80 text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span className="text-xs font-black">Prayer Board</span>
                <span className="text-[10px] text-slate-400">Weekly Needs</span>
              </button>

              <button
                onClick={() => onNavigate(isCoordinator ? "members" : "users")}
                className="p-3 rounded-2xl bg-slate-100/60 hover:bg-slate-100 text-slate-900 border border-slate-200/80 text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95"
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-black">{isCoordinator ? "Directory" : "User Roles"}</span>
                <span className="text-[10px] text-slate-400">Audit Access</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Birthday Greeting Modal */}
      {greetingMember && createPortal(
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 animate-in fade-in zoom-in duration-200">
            <div className="mb-4 flex items-center justify-between">
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
        </div>,
        document.body
      )}

      {/* 🌊 Water Baptism Candidate Review & Nomination Modal */}
      {showBaptismModal && createPortal(
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full my-auto shadow-2xl border border-cyan-100 animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-cyan-900 via-sky-900 to-indigo-950 text-white flex items-start justify-between gap-4 shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-start gap-3.5 relative z-10">
                <div className="p-3 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 shadow-inner shrink-0">
                  <Droplets className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-lg text-white">Water Baptism Candidate Nominations</h3>
                    <span className="text-[11px] font-black uppercase tracking-wider bg-cyan-400/20 text-cyan-200 border border-cyan-300/30 px-2.5 py-0.5 rounded-full">
                      {baptismCandidateData?.counts.total_qualified || 0} Disciples Qualified
                    </span>
                  </div>
                  <p className="text-xs text-cyan-100/80 mt-1 max-w-xl leading-relaxed">
                    Disciples qualified through faithful Sunday attendance (~1 year or 0 absences). Nominate candidates with one click to enroll them for the ceremony.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBaptismModal(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer shrink-0 relative z-10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 bg-cyan-50/40 border-b border-cyan-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-cyan-200/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCandidateFilterTab("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    candidateFilterTab === "all"
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs"
                      : "text-charcoal/70 hover:text-charcoal hover:bg-cyan-50/50"
                  }`}
                >
                  All Qualified ({baptismCandidateData?.counts.total_qualified || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateFilterTab("pending")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    candidateFilterTab === "pending"
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs"
                      : "text-charcoal/70 hover:text-charcoal hover:bg-cyan-50/50"
                  }`}
                >
                  Pending Nomination ({baptismCandidateData?.counts.pending_nomination || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateFilterTab("nominated")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    candidateFilterTab === "nominated"
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs"
                      : "text-charcoal/70 hover:text-charcoal hover:bg-cyan-50/50"
                  }`}
                >
                  Nominated ({baptismCandidateData?.counts.already_candidates || 0})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search disciple name..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className="text-xs px-3.5 py-2 rounded-xl bg-white border border-cyan-200 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 w-full sm:w-48 shadow-2xs"
                />

                {baptismCandidateData && baptismCandidateData.counts.pending_nomination > 0 && (
                  <button
                    type="button"
                    onClick={handleNominateAllCandidates}
                    disabled={isBulkNominating}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-black shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isBulkNominating ? "Nominating..." : "Nominate All"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Candidates Scrollable Grid */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1 bg-ivory-light/30">
              {(() => {
                const candidates = (baptismCandidateData?.candidates || []).filter((c) => {
                  if (candidateFilterTab === "pending" && !c.is_ready_for_nomination) return false;
                  if (candidateFilterTab === "nominated" && !c.is_candidate) return false;
                  if (candidateSearch.trim()) {
                    const q = candidateSearch.toLowerCase();
                    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
                    const minName = (c.ministry_name || "").toLowerCase();
                    return fullName.includes(q) || minName.includes(q);
                  }
                  return true;
                });

                if (candidates.length === 0) {
                  return (
                    <div className="py-12 text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center mx-auto shadow-2xs">
                        <Droplets className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-black text-sm text-indigo-950">No Candidates Found</h4>
                        <p className="text-xs text-charcoal/60 max-w-sm mx-auto">
                          {candidateSearch
                            ? `No qualified candidates matching "${candidateSearch}"`
                            : candidateFilterTab === "pending"
                            ? "All qualified disciples have already been nominated as candidates!"
                            : "No qualified baptism candidates currently available."}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {candidates.map((candidate) => {
                      const isNominating = nominatingIds.includes(candidate.id);
                      return (
                        <div
                          key={candidate.id}
                          className={`p-4 rounded-2xl border transition-all duration-200 bg-white shadow-2xs flex flex-col justify-between space-y-3 hover:shadow-md ${
                            candidate.is_candidate
                              ? "border-emerald-200 bg-gradient-to-br from-emerald-50/20 via-white to-teal-50/10"
                              : "border-cyan-200 hover:border-cyan-400"
                          }`}
                        >
                          <div className="space-y-2.5">
                            {/* Top Member Header */}
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-2xs ring-2 ring-white"
                                  style={{ backgroundColor: candidate.ministry_color || "#0284c7" }}
                                >
                                  {candidate.first_name[0]}{candidate.last_name[0]}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-black text-sm text-indigo-950 truncate leading-snug">
                                    {candidate.first_name} {candidate.last_name}
                                  </h4>
                                  <p className="text-[11px] text-charcoal/60 truncate">
                                    {candidate.age ? `Age ${candidate.age} • ` : ""}{candidate.ministry_name || "Discipleship"}
                                  </p>
                                </div>
                              </div>

                              {candidate.is_candidate ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-300 shadow-2xs shrink-0">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Candidate</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-cyan-800 bg-cyan-100/80 px-2.5 py-1 rounded-xl border border-cyan-300 shadow-2xs shrink-0 animate-pulse">
                                  <Sparkles className="w-3 h-3 text-cyan-600" />
                                  <span>Ready</span>
                                </span>
                              )}
                            </div>

                            {/* Qualification Reason Badge */}
                            <div className="p-2.5 rounded-xl bg-cyan-50/60 border border-cyan-100 text-xs text-indigo-950 flex items-center gap-2">
                              <Award className="w-4 h-4 text-cyan-700 shrink-0" />
                              <span className="font-bold text-[11px] line-clamp-1">{candidate.qualification_reason}</span>
                            </div>

                            {/* Attendance Consistency KPI Strip */}
                            <div className="space-y-1.5 p-2.5 bg-ivory-light/60 rounded-xl border border-indigo-50 text-xs">
                              <div className="flex items-center justify-between text-[11px] font-black text-charcoal/80">
                                <span className="flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{candidate.total_present} Services Present</span>
                                </span>
                                <span className={candidate.total_absent === 0 ? "text-emerald-700 font-extrabold" : "text-charcoal/60"}>
                                  {candidate.total_absent === 0 ? "🌟 0 Absences" : `${candidate.total_absent} Absences`}
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                                <div
                                  className="bg-gradient-to-r from-cyan-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(100, Math.max(10, candidate.consistency_rate))}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-charcoal/50">
                                <span>Attendance Consistency</span>
                                <strong className="text-cyan-900 font-black">{candidate.consistency_rate}%</strong>
                              </div>
                            </div>

                            {/* Bible Study Group Badge */}
                            {candidate.bible_study_group_name && (
                              <div className="flex items-center gap-1.5 text-[10px] text-indigo-950 font-bold bg-indigo-50/80 px-2.5 py-1 rounded-xl border border-indigo-100">
                                <BookOpen className="w-3 h-3 text-indigo-600 shrink-0" />
                                <span className="truncate">Group: <strong>{candidate.bible_study_group_name}</strong> {candidate.bible_study_leader_name ? `(${candidate.bible_study_leader_name})` : ""}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Button */}
                          <div className="pt-2 border-t border-indigo-50 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-charcoal/50 truncate">
                              {candidate.contact_phone || candidate.household_name || "Faithful Discipleship"}
                            </span>

                            {candidate.is_ready_for_nomination ? (
                              <button
                                type="button"
                                onClick={() => handleNominateCandidate(candidate.id)}
                                disabled={isNominating}
                                className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 disabled:opacity-50"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>{isNominating ? "Nominating..." : "Nominate Candidate"}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onNavigate("members")}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <span>View Directory</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-white border-t border-indigo-100/80 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-charcoal/70">
                <span>Total Qualified: <strong className="text-indigo-950 font-black">{baptismCandidateData?.counts.total_qualified || 0}</strong></span>
                <span className="mx-2">•</span>
                <span>Ready: <strong className="text-cyan-800 font-black">{baptismCandidateData?.counts.pending_nomination || 0}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBaptismModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/70 hover:bg-gray-100 border border-gray-200 transition-all cursor-pointer"
                >
                  Close
                </button>
                {baptismCandidateData && baptismCandidateData.counts.pending_nomination > 0 && (
                  <button
                    type="button"
                    onClick={handleNominateAllCandidates}
                    disabled={isBulkNominating}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isBulkNominating ? "Nominating..." : `Nominate All (${baptismCandidateData.counts.pending_nomination})`}</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

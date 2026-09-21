import React, { useState, useMemo } from "react";
import { BibleStudyGroup, BibleStudyMember, StudyTopic, SundayDutyScheduleItem } from "../../types";
import {
  Users, Clock, BookmarkCheck, MessageSquare, MapPin,
  UserCheck, Plus, BookOpen, ArrowRight,
  CalendarCheck, CalendarClock, Utensils, AlertCircle, Sparkles,
  ChevronRight, Calendar, ShieldCheck, ClipboardCheck,
  TrendingUp, Send, Download, MoreVertical, Phone,
  Sparkle, CheckCircle2, ArrowLeftRight, Check, X
} from "lucide-react";
import { NavTab } from "../../components/layout/Sidebar";
import { getBookTotalChapters } from "../../utils/curriculumHelper";

// Default / mock duty rotation schedule for groups
interface DutyRotationItem {
  id: string;
  date: string;
  group_name: string;
  category: "Sunday Dishwashing" | "Fellowship Meal Service";
  checklist: string;
  status: "completed" | "active" | "scheduled";
  is_my_group?: boolean;
}

const DEFAULT_DUTY_ROTATIONS: DutyRotationItem[] = [
  {
    id: "duty-1",
    date: "Sun, Nov 01",
    group_name: "Couples for Christ Cell",
    category: "Sunday Dishwashing",
    checklist: "Full kitchen sanitation, dish racks wipe down & cutlery storage.",
    status: "completed"
  },
  {
    id: "duty-2",
    date: "Sun, Nov 08",
    group_name: "Men of Valor Cell Group",
    category: "Sunday Dishwashing",
    checklist: "Scrub cooking pots, clean 3-compartment sink & dispose garbage.",
    status: "completed"
  },
  {
    id: "duty-3",
    date: "Sun, Nov 15",
    group_name: "BS group ni ate April",
    category: "Sunday Dishwashing",
    checklist: "Full plates/pots rinse, 3-compartment sink, trash disposal & dish drying.",
    status: "active",
    is_my_group: true
  },
  {
    id: "duty-4",
    date: "Sun, Nov 22",
    group_name: "Young Adults Discipleship",
    category: "Sunday Dishwashing",
    checklist: "Dishwashing rotation, fellowship hall sweeping & trash clearing.",
    status: "scheduled"
  },
  {
    id: "duty-5",
    date: "Sun, Nov 29",
    group_name: "Junior Ministry Teachers",
    category: "Sunday Dishwashing",
    checklist: "Pre-rinse plates, sanitize cups, wipe down dining tables.",
    status: "scheduled"
  }
];

interface LeaderDashboardProps {
  activeGroup: BibleStudyGroup | null;
  groupDisciples: BibleStudyMember[];
  studyTopics: StudyTopic[];
  designatedDishwashing?: SundayDutyScheduleItem[];
  isMemberView?: boolean;
  onNavigateTab: (tab: "dashboard" | "members" | "biblestudy" | "attendance_monitor" | "duty") => void;
  onNavigateGeneralTab?: (tab: NavTab) => void;
  onOpenRollCall?: () => void;
  onOpenBulletin?: () => void;
  onOpenAddDisciple?: () => void;
  onOpenSwapShift?: () => void;
  onOpenReschedule?: () => void;
}

export const LeaderDashboard: React.FC<LeaderDashboardProps> = ({
  activeGroup,
  groupDisciples,
  studyTopics,
  designatedDishwashing = [],
  isMemberView = false,
  onNavigateTab,
  onNavigateGeneralTab,
  onOpenRollCall,
  onOpenBulletin,
  onOpenAddDisciple,
  onOpenSwapShift,
  onOpenReschedule
}) => {
  const [dutyFilter, setDutyFilter] = useState<string>("all");
  const [highlightMyGroup, setHighlightMyGroup] = useState<boolean>(false);

  // Group Capacity Calculations
  const enrolledCount = groupDisciples.length;
  const maxCapacity = activeGroup?.max_capacity || 12;
  const capacityPercent = Math.min(100, Math.round((enrolledCount / maxCapacity) * 100));

  // Capacity color rule: Green >= 80%, Yellow 40-79%, Red < 40%
  const getCapacityTheme = (pct: number) => {
    if (pct >= 80) return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
    if (pct >= 40) return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
    return { bar: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50 border-rose-200" };
  };
  const capacityTheme = getCapacityTheme(capacityPercent);

  // Curriculum calculations
  const totalChapters = useMemo(() => {
    if (!activeGroup?.curriculum) return 12;
    return getBookTotalChapters(activeGroup.curriculum, studyTopics);
  }, [activeGroup?.curriculum, studyTopics]);

  const currentChapterNum = useMemo(() => {
    if (!activeGroup?.current_chapter) return 4;
    const match = activeGroup.current_chapter.match(/\d+/);
    return match ? parseInt(match[0], 10) : 4;
  }, [activeGroup?.current_chapter]);

  const courseProgressPercent = Math.min(100, Math.round((currentChapterNum / totalChapters) * 100));

  // Filtered Duty items
  const filteredDuties = useMemo(() => {
    return DEFAULT_DUTY_ROTATIONS.filter(item => {
      if (dutyFilter !== "all" && item.category !== dutyFilter) return false;
      if (highlightMyGroup && !item.is_my_group) return false;
      return true;
    });
  }, [dutyFilter, highlightMyGroup]);

  if (!activeGroup) {
    return (
      <div className="p-8 bg-gradient-to-r from-sky-50 via-indigo-50 to-sky-50 rounded-3xl border border-sky-200 text-slate-800 space-y-3 text-center">
        <Users className="w-10 h-10 mx-auto text-sky-600" />
        <h3 className="font-black text-lg text-slate-900">No Life Group Selected</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Please select or assign a small group from the switcher above to view discipleship health, roll-call, and rosters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* 1. Hero Group Banner (Matching Mockup) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <img
          src="/container_bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35 mix-blend-screen pointer-events-none"
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[11px] font-black uppercase tracking-wider backdrop-blur-md">
              <BookOpen className="w-3.5 h-3.5 text-amber-300" />
              <span>Small Group Ministry Directory</span>
            </div>
            <span className="text-[11px] bg-white/10 border border-white/15 text-slate-200 font-bold px-3 py-1 rounded-full backdrop-blur-md">
              January 2026 - Present
            </span>
            <span className="text-[11px] bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 font-bold px-3 py-1 rounded-full backdrop-blur-md">
              Facilitator: {activeGroup.leader_name || "Sis April Cruz"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-indigo-500/30 border border-white/20 flex items-center justify-center font-black text-amber-300 shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {activeGroup.name}
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
            {activeGroup.description || "Weekly sisterhood fellowship focusing on intentional discipleship, gospel accountability, and holistic servant leadership in Camarines Norte."}
          </p>

          <div className="flex items-center gap-3 flex-wrap pt-1">
            <div className="flex items-center gap-2 bg-white/10 border border-white/15 px-3.5 py-1.5 rounded-xl text-xs text-white font-semibold backdrop-blur-md">
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <span>Every {activeGroup.meeting_day} - {activeGroup.meeting_time || "5:00 PM - 6:30 PM"}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 border border-white/15 px-3.5 py-1.5 rounded-xl text-xs text-white font-semibold backdrop-blur-md">
              <MapPin className="w-3.5 h-3.5 text-emerald-300" />
              <span>{activeGroup.location || "Fellowship Room 2 / Upper Chapel"}</span>
            </div>

            {/* Direct Reschedule Action Button */}
            {onOpenReschedule && (
              <button
                type="button"
                onClick={onOpenReschedule}
                className="flex items-center gap-1.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/40 px-3 py-1.5 rounded-xl text-xs font-bold transition-all backdrop-blur-md cursor-pointer hover:scale-105 active:scale-95"
              >
                <CalendarClock className="w-3.5 h-3.5 text-amber-300" />
                <span>{activeGroup.is_rescheduled ? "Modify Reschedule / Rooms" : "Reschedule & Check Rooms"}</span>
              </button>
            )}
          </div>

          {/* Active Rescheduled Alert Pill */}
          {activeGroup.is_rescheduled && (
            <div className="mt-2 bg-amber-500/20 border border-amber-400/50 rounded-2xl p-3 flex items-start justify-between gap-3 text-amber-100 backdrop-blur-md">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-amber-200 flex items-center gap-2">
                    <span>⚡ Session Rescheduled</span>
                    {activeGroup.rescheduled_date && (
                      <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black">
                        {new Date(activeGroup.rescheduled_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-100/90 font-medium">
                    Time: <span className="font-bold text-white">{activeGroup.rescheduled_time || activeGroup.meeting_time}</span>
                    {activeGroup.location && <> • Room: <span className="font-bold text-white">{activeGroup.location}</span></>}
                    {activeGroup.reschedule_reason && <> • Reason: <span className="italic">"{activeGroup.reschedule_reason}"</span></>}
                  </p>
                </div>
              </div>
              {onOpenReschedule && (
                <button
                  type="button"
                  onClick={onOpenReschedule}
                  className="shrink-0 px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Manage
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative z-10 flex flex-col gap-3 shrink-0 lg:w-72">
          <button
            onClick={() => {
              if (onOpenRollCall) onOpenRollCall();
              else onNavigateTab("biblestudy");
            }}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-5 py-3 rounded-2xl text-xs shadow-lg hover:shadow-xl transition-all active:scale-95 cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4 text-indigo-950" />
            <span>Take Weekly Roll-Call</span>
          </button>

          <button
            onClick={() => {
              if (onOpenBulletin) onOpenBulletin();
            }}
            className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold px-4 py-2.5 rounded-2xl text-xs backdrop-blur-md shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4 text-amber-300" />
            <span>Send Group Bulletin</span>
          </button>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2 font-bold text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Weekly Session Arriving Soon</span>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-black text-[10px] px-2 py-0.5 rounded-full uppercase">
              In 2D
            </span>
          </div>
        </div>
      </div>

      {/* 2. 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: GROUP CAPACITY */}
        <div className="bg-white p-5 rounded-3xl border border-indigo-100/80 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-charcoal/60 uppercase tracking-wider">Group Capacity</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-charcoal">
                {enrolledCount} <span className="text-sm font-bold text-charcoal/50">/ {maxCapacity}</span>
              </h3>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${capacityTheme.bg} ${capacityTheme.text}`}>
                {capacityPercent >= 100 ? "At Max Capacity" : `${capacityPercent}% Full`}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${capacityTheme.bar}`}
                style={{ width: `${capacityPercent}%` }}
              ></div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-charcoal/60 font-bold border-t border-gray-100 pt-2">
            <span>Waitlist: 0</span>
            <span className={capacityTheme.text}>In-Group: {capacityPercent}% full</span>
          </div>
        </div>

        {/* Card 2: RECENT ATTENDANCE */}
        <div
          onClick={() => onNavigateTab("attendance_monitor")}
          className="bg-white p-5 rounded-3xl border border-indigo-100/80 shadow-2xs flex flex-col justify-between space-y-3 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all active:scale-98"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-charcoal/60 uppercase tracking-wider">Recent Attendance</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-charcoal">Monitor</h3>
              <span className="text-[11px] font-extrabold text-emerald-600 flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> View Logs
              </span>
            </div>
            <p className="text-[11px] text-charcoal/50 font-bold mt-1">Check past sessions & absentee counts →</p>
          </div>
          <div className="flex items-center justify-between text-[10px] text-charcoal/60 font-bold border-t border-gray-100 pt-2">
            <span>{enrolledCount} active disciples</span>
            <span className="text-emerald-700 font-extrabold">Open Monitor ↗</span>
          </div>
        </div>

        {/* Card 3: DISCIPLESHIP CURRICULUM */}
        <div className="bg-white p-5 rounded-3xl border border-indigo-100/80 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-charcoal/60 uppercase tracking-wider">Discipleship Curriculum</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-indigo">
              Ch. {currentChapterNum} <span className="text-sm font-bold text-charcoal/50">of {totalChapters}</span>
            </h3>
            <p className="text-[11px] text-charcoal/60 font-bold truncate mt-1">
              {activeGroup.curriculum || "Faith Foundations"}
            </p>
          </div>
          <div className="flex items-center justify-between text-[10px] text-charcoal/60 font-bold border-t border-gray-100 pt-2">
            <span>Faith Foundations</span>
            <span className="text-indigo">All tracks</span>
          </div>
        </div>

        {/* Card 4: NEXT ROTATION DUTY */}
        <div className="bg-white p-5 rounded-3xl border border-indigo-100/80 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-charcoal/60 uppercase tracking-wider">Next Rotation Duty</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-black text-charcoal">Sun, Nov 15</h3>
              <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase">
                Assigned
              </span>
            </div>
            <p className="text-[11px] text-amber-900 font-bold mt-1">Sunday Dishwashing Roster</p>
          </div>
          <div className="flex items-center justify-between text-[10px] text-charcoal/60 font-bold border-t border-gray-100 pt-2">
            <span>Sunday Dishwashing</span>
            <span className="text-charcoal/70">Gym / K-2</span>
          </div>
        </div>
      </div>

      {/* 3. Leader Command Quick Actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
            <h3 className="text-sm font-black text-charcoal uppercase tracking-wider">Leader Command Quick Actions</h3>
          </div>
          <span className="text-[11px] text-charcoal/50 font-bold">Instant small group shepherd controls • Real-time sync</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => onNavigateTab("biblestudy")}
            className="bg-white p-5 rounded-3xl border border-amber-200/80 hover:border-amber-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
            </div>
            <div>
              <h4 className="text-sm font-black text-charcoal group-hover:text-amber-800 transition-colors">Take Roll-Call</h4>
              <p className="text-[11px] text-charcoal/60 mt-1 leading-relaxed">
                Mark attendance, track absentee check-ins & record session notes for {activeGroup.meeting_day}.
              </p>
            </div>
            <span className="text-[11px] font-black text-amber-700 flex items-center gap-1 group-hover:underline">
              Open Session Wizard →
            </span>
          </div>

          <div
            onClick={() => onNavigateTab("members")}
            className="bg-white p-5 rounded-3xl border border-teal-200/80 hover:border-teal-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-teal-600 group-hover:translate-x-1 transition-transform" />
            </div>
            <div>
              <h4 className="text-sm font-black text-charcoal group-hover:text-teal-800 transition-colors">Manage Disciples</h4>
              <p className="text-[11px] text-charcoal/60 mt-1 leading-relaxed">
                Access member profiles, family ties, emergency hotlines, and spiritual milestones.
              </p>
            </div>
            <span className="text-[11px] font-black text-teal-700 flex items-center gap-1 group-hover:underline">
              {enrolledCount} Active Disciples →
            </span>
          </div>

          <div
            onClick={() => onNavigateTab("biblestudy")}
            className="bg-white p-5 rounded-3xl border border-indigo-200/80 hover:border-indigo-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
            </div>
            <div>
              <h4 className="text-sm font-black text-charcoal group-hover:text-indigo transition-colors">Curriculum Topics</h4>
              <p className="text-[11px] text-charcoal/60 mt-1 leading-relaxed">
                Leader lesson plans, commentary downloads, and discussion starters.
              </p>
            </div>
            <span className="text-[11px] font-black text-indigo flex items-center gap-1 group-hover:underline">
              Explore {totalChapters} Chapters →
            </span>
          </div>

          <div
            onClick={() => onNavigateTab("biblestudy")}
            className="bg-white p-5 rounded-3xl border border-purple-200/80 hover:border-purple-400 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-purple-600 group-hover:translate-x-1 transition-transform" />
            </div>
            <div>
              <h4 className="text-sm font-black text-charcoal group-hover:text-purple-800 transition-colors">Daily Bible Reading</h4>
              <p className="text-[11px] text-charcoal/60 mt-1 leading-relaxed">
                Track scripture reading sync, biblical group companion recipes and daily passages.
              </p>
            </div>
            <span className="text-[11px] font-black text-purple-700 flex items-center gap-1 group-hover:underline">
              Day 104 - 1 Cor 13 →
            </span>
          </div>
        </div>
      </div>

      {/* 4. Designated Sunday Dishwashing Rotations */}
      <div className="bg-white p-6 rounded-3xl border border-indigo-100/80 shadow-2xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-charcoal">Designated Sunday Dishwashing Rotations</h3>
              <p className="text-xs text-charcoal/60">
                Quarterly Sunday fellowship meal dishwashing roster for DPC Faith Center Church small groups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setDutyFilter(dutyFilter === "Sunday Dishwashing" ? "all" : "Sunday Dishwashing")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${dutyFilter === "Sunday Dishwashing"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-ivory-light text-charcoal/70 hover:bg-gray-100 border border-gray-200"
                }`}
            >
              Sunday Dishwashing
            </button>
            <button
              onClick={() => setHighlightMyGroup(!highlightMyGroup)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${highlightMyGroup
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "bg-ivory-light text-charcoal/70 hover:bg-gray-100 border border-gray-200"
                }`}
            >
              Highlight My Group's Turn
            </button>
            <button
              onClick={onOpenSwapShift}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-gray-50 text-indigo border border-indigo-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Request Shift Swap</span>
            </button>
          </div>
        </div>

        {/* Upcoming Assignment Banner */}
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/10 border border-amber-300/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase">
                  Upcoming Assignment
                </span>
                <span className="text-xs font-bold text-amber-950">Sunday Fellowship Meal Service</span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-amber-950">
                Sunday Dishwashing Duty • Sun, Nov 15
              </h4>
              <p className="text-xs text-amber-900/90 leading-tight">
                Assigned: <strong>{activeGroup.name}</strong> • Task Scope: Basin & Kitchen Scrubdown, Utensil Sanitizing...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <div className="flex -space-x-2 overflow-hidden">
              {['R', 'G', 'E', 'I'].map((char, idx) => (
                <div key={idx} className="inline-block h-7 w-7 rounded-full ring-2 ring-white bg-indigo-900 text-amber-300 text-[10px] font-black flex items-center justify-center">
                  {char}
                </div>
              ))}
            </div>
            <button
              onClick={() => { }}
              className="bg-slate-950 hover:bg-slate-900 text-amber-300 border border-amber-400/40 px-3.5 py-2 rounded-xl text-xs font-black shadow-md cursor-pointer transition-all active:scale-95"
            >
              Confirm Team (6/6)
            </button>
          </div>
        </div>

        {/* Duty Rotation Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[10px] font-black text-charcoal/60 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Rotation Date</th>
                <th className="py-3 px-4">Assigned Group / Ministry</th>
                <th className="py-3 px-4">Service Category</th>
                <th className="py-3 px-4">Standard Operating Checklist</th>
                <th className="py-3 px-4 text-right">Status & Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDuties.map((item) => {
                const isCurrentActive = item.is_my_group;
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${isCurrentActive
                      ? "bg-amber-50/80 border-l-4 border-l-amber-500 font-semibold text-amber-950"
                      : "hover:bg-gray-50/80 text-charcoal"
                      }`}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap font-bold">
                      {item.date}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span>{item.group_name}</span>
                        {isCurrentActive && (
                          <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                            Your Turn
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo border border-indigo-200">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-charcoal/70 max-w-xs truncate">
                      {item.checklist}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {item.status === "completed" && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      )}
                      {item.status === "active" && (
                        <span className="inline-flex items-center gap-1 text-amber-950 font-black bg-amber-400 border border-amber-500 px-2.5 py-0.5 rounded-full text-[10px] animate-pulse">
                          <Clock className="w-3 h-3" /> Active in 2 Days
                        </span>
                      )}
                      {item.status === "scheduled" && (
                        <span className="inline-flex items-center gap-1 text-charcoal/60 font-bold bg-gray-100 px-2.5 py-0.5 rounded-full text-[10px]">
                          Scheduled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs text-charcoal/60 pt-1">
          <span>Showing {filteredDuties.length} of 16 quarterly duty assignments</span>
          <button
            onClick={() => onNavigateTab("duty")}
            className="text-indigo font-bold hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>View Full Roster Matrix</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 5. Bottom 2-Column Split: Disciples Roster & Curriculum / Prayer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Group Disciples Roster (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-indigo-100/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-charcoal">
                  Group Disciples Roster ({enrolledCount})
                </h3>
                <p className="text-[11px] text-charcoal/50">
                  Assigned members in {activeGroup.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { }}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-charcoal font-bold text-xs transition-colors cursor-pointer"
              >
                Import
              </button>
              <button
                onClick={onOpenAddDisciple}
                className="flex items-center gap-1 bg-slate-950 hover:bg-slate-900 text-white font-black px-3.5 py-1.5 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-300" />
                <span>+ Add Disciple</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[450px] overflow-y-auto pr-1">
            {groupDisciples.length > 0 ? (
              groupDisciples.map((m: any, idx: number) => {
                const name = m.member_name || `${m.first_name || ""} ${m.last_name || ""}` || `Disciple ${idx + 1}`;
                const initials = name.split(" ").map((n: string) => n[0]).join("").substring(0, 2);
                return (
                  <div key={idx} className="py-3 flex items-center justify-between gap-3 group hover:bg-gray-50/50 rounded-xl px-2 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-900 to-slate-900 text-amber-300 font-bold flex items-center justify-center text-xs shrink-0 shadow-inner">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-black text-charcoal group-hover:text-indigo transition-colors truncate">
                            {name}
                          </h4>
                          <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 font-bold px-2 py-0.2 rounded-full">
                            {idx === 0 ? "Life Group Peer" : "Baptized Faithful"}
                          </span>
                        </div>
                        <div className="text-[11px] text-charcoal/50 mt-0.5">
                          {m.contact_phone || "Contact via Shepherd"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        4/4 Attended • 100%
                      </span>
                      <button
                        className="p-1.5 text-charcoal/50 hover:text-indigo hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                        title="Call Disciple"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onNavigateTab("members")}
                        className="p-1.5 text-charcoal/40 hover:text-charcoal hover:bg-gray-100 rounded-lg cursor-pointer"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-charcoal/50 space-y-2">
                <Users className="w-8 h-8 mx-auto text-charcoal/30" />
                <p className="text-xs font-bold">No disciples enrolled yet in this life group.</p>
                <button
                  onClick={onOpenAddDisciple}
                  className="text-xs text-indigo font-bold underline cursor-pointer"
                >
                  Assign members now
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-charcoal/60 pt-2 border-t border-gray-100">
            <span>Total {enrolledCount} active disciples • 0 on wait search</span>
            <button
              onClick={() => onNavigateTab("members")}
              className="text-indigo font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>View All Profiles</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column: Active Curriculum + Prayer Requests (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Active Curriculum */}
          <div className="bg-white p-6 rounded-3xl border border-indigo-100/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-charcoal">Active Curriculum</h3>
              </div>
              <span className="text-[10px] font-black bg-teal-100 text-teal-900 px-2 py-0.5 rounded-full uppercase">
                Term 2
              </span>
            </div>

            <div>
              <div className="text-[10px] text-teal-700 font-extrabold uppercase tracking-wider mb-0.5">
                Main Track • Week {currentChapterNum} of {totalChapters}
              </div>
              <h4 className="text-base font-black text-charcoal leading-snug">
                {activeGroup.curriculum || "Walking in Covenant: The Book of Ezekiel"}
              </h4>
              <p className="text-xs text-charcoal/70 mt-1 leading-relaxed">
                An in-depth discipleship journey exploring repentance, the glory of God, and the living breath flowing from the temple sanctuary.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-charcoal/70">
                <span>Course Progress</span>
                <span className="text-teal-700 font-black">{courseProgressPercent}% Completed</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${courseProgressPercent}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Leader Discussion Starter ({activeGroup.meeting_day})</span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed italic">
                "How does Ezekiel 37:1-14 challenge our spiritual despairing? How does God's breath of salvation re-animate depths of total surrender?"
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => { }}
                className="flex-1 py-2 px-3 rounded-xl bg-ivory-light hover:bg-gray-100 border border-gray-200 text-charcoal text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Leader Discussion PDF</span>
              </button>
              <button
                onClick={() => onNavigateTab("biblestudy")}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 text-amber-300 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>Open Study Guide</span>
              </button>
            </div>
          </div>

          {/* Card 2: Shepherd Notes & Weekly Flock Goal */}
          <div className="bg-white p-6 rounded-3xl border border-indigo-100/80 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-charcoal">Shepherd Notes & Discussion Goal</h3>
              </div>
              <span className="text-[10px] font-black bg-indigo-50 text-indigo border border-indigo-200 px-2 py-0.5 rounded-full">
                Weekly Focus
              </span>
            </div>

            <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-charcoal">
                <span className="flex items-center gap-1.5 text-indigo-900 font-extrabold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Fellowship Objective
                </span>
                <span className="text-charcoal/50">Next: {activeGroup.meeting_day}</span>
              </div>
              <p className="text-[11px] text-charcoal/70 leading-relaxed">
                Encourage deep transparency among disciples, ensure everyone has their study passages prepared, and follow up with absentees.
              </p>
            </div>

            <button
              onClick={() => {
                if (onOpenBulletin) onOpenBulletin();
              }}
              className="w-full py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo font-black text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast Bulletin to Disciples</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

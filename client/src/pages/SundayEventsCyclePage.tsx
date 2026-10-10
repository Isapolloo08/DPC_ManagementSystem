import { EventMinistryPicker } from "../components/events/EventMinistryPicker";
import { FilterPanel } from "../components/common/FilterPanel";
import { Pagination } from "../components/common/Pagination";
import { useListPagination } from "../hooks/useListPagination";
import { PageHeader } from "../components/common/PageHeader";
import { CardGridSkeleton, Skeleton } from "../components/common/SkeletonLoader";
import { Button } from "../components/common/Button";
import { ViewportOverlay } from "../components/common/ViewportOverlay";
import { CalendarDays as UICalendarDays, Check as UICheck, MapPin as UIMapPin, RefreshCw as UIRefreshCw } from "lucide-react";
import { ModalPanel } from "../components/common/ModalPanel";
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { RecurringSundayEvent, RecurringSundayEventsResponse, EventItem, Ministry } from "../types";
import { useSocketEvent } from "../socket";
import {
  Calendar, Plus, Search, Filter, Clock, MapPin,
  CheckCircle2, ArrowRight, X, Edit2, Trash2, Heart, Award,
  Users, Sun, Droplets, Gift, BookOpen, Crown, Smile, Globe,
  ShieldCheck, Flame, RefreshCw, Layers, Check, ChevronRight,
  Repeat, CalendarDays, Bell, Tag
} from "lucide-react";
import "./SundayEventsCyclePage.css";

interface FormState {
  is_annual_recurring: boolean;
  title: string;
  description: string;
  ministry_ids: number[];
  target_ministry_id: number | null;
  target_ministry_name: string;
  // Recurring-specific fields
  month: number;
  week_pattern: string;
  program_highlights: string;
  color: string;
  icon: string;
  // One-time specific fields
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
}

export const SundayEventsCyclePage: React.FC = () => {
  const { user, ministries } = useAuth();
  const { showToast, deleteWithUndo } = useToast();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [cycleData, setCycleData] = useState<RecurringSundayEventsResponse | null>(null);
  const [regularEvents, setRegularEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"all" | "recurring" | "one_time">("all");
  const [selectedQuarter, setSelectedQuarter] = useState<"all" | "Q1" | "Q2" | "Q3" | "Q4">("all");
  const [selectedMinistryFilter, setSelectedMinistryFilter] = useState<string>("all");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<{
    type: "recurring" | "one_time";
    id: number;
    rawRecurring?: RecurringSundayEvent;
    rawOneTime?: EventItem;
  } | null>(null);

  const [formData, setFormData] = useState<FormState>({
    is_annual_recurring: true,
    title: "",
    description: "",
    ministry_ids: [],
    target_ministry_id: null,
    target_ministry_name: "Church-wide / All Ministries",
    month: new Date().getMonth() + 1,
    week_pattern: "1st_sunday",
    program_highlights: "",
    color: "#2C3968",
    icon: "Award",
    event_date: new Date().toISOString().split("T")[0],
    start_time: "09:00",
    end_time: "11:30",
    location: "Main Sanctuary"
  });

  // Settings Room Locations state
  const [roomLocations, setRoomLocations] = useState<string[]>([]);
  const [isCustomLocation, setIsCustomLocation] = useState<boolean>(false);
  const [isSyncCustomLocation, setIsSyncCustomLocation] = useState<boolean>(false);

  // Sync / Schedule Modal State (for Recurring events)
  const [syncingEvent, setSyncingEvent] = useState<RecurringSundayEvent | null>(null);
  const [syncStartTime, setSyncStartTime] = useState<string>("09:00");
  const [syncEndTime, setSyncEndTime] = useState<string>("12:00");
  const [syncLocation, setSyncLocation] = useState<string>("Main Sanctuary");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const isAdminOrCoordinator = user?.role_name === "Admin" || user?.role_name === "Pastor" || user?.role_name === "Coordinator" || user?.role_name === "IT Admin";

  useEffect(() => {
    loadAllEvents();
    loadRoomLocations();
  }, [selectedYear]);

  useSocketEvent("events:changed", () => {
    loadAllEvents();
  });

  useSocketEvent("lookups:changed", () => {
    loadRoomLocations();
  });

  const loadRoomLocations = async () => {
    try {
      const res = await api.getLookups({ type: "event_location", active_only: true });
      if (res && res.length > 0) {
        setRoomLocations(res.map((l) => l.name));
      } else {
        setRoomLocations([
          "Main Sanctuary",
          "Fellowship Hall",
          "Room 102 (Children Wing)",
          "Youth Loft Center",
          "Prayer Garden"
        ]);
      }
    } catch (err) {
      console.warn("Failed to load room locations from settings:", err);
      setRoomLocations([
        "Main Sanctuary",
        "Fellowship Hall",
        "Room 102 (Children Wing)",
        "Youth Loft Center",
        "Prayer Garden"
      ]);
    }
  };

  const loadAllEvents = async () => {
    guideData.clearError();
    try {
      setLoading(true);
      const [cycleRes, eventsRes] = await Promise.all([
        api.getRecurringSundayEvents({ year: selectedYear }),
        api.getEvents({ from: selectedYear + "-01-01", to: selectedYear + "-12-31" })
      ]);
      setCycleData(cycleRes);
      setRegularEvents(eventsRes || []);
    } catch (err) {
      console.error("Failed to load events and celebrations:", err);
      guideData.reportError(err);
    } finally {
      setLoading(false);
    }
  };


  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getWeekPatternLabel = (pattern: string) => {
    switch (pattern) {
      case "1st_sunday": return "1st Sunday of the Month";
      case "2nd_sunday": return "2nd Sunday of the Month";
      case "3rd_sunday": return "3rd Sunday of the Month";
      case "4th_sunday": return "4th Sunday of the Month";
      case "last_sunday": return "Last Sunday of the Month";
      default: return pattern;
    }
  };

  const getEventIcon = (iconName?: string) => {
    switch (iconName) {
      case "Heart": return <Heart className="w-5 h-5" />;
      case "Award": return <Award className="w-5 h-5" />;
      case "Sun": return <Sun className="w-5 h-5" />;
      case "Droplets": return <Droplets className="w-5 h-5" />;
      case "Gift": return <Gift className="w-5 h-5" />;
      case "BookOpen": return <BookOpen className="w-5 h-5" />;
      case "Crown": return <Crown className="w-5 h-5" />;
      case "Smile": return <Smile className="w-5 h-5" />;
      case "Globe": return <Globe className="w-5 h-5" />;
      case "ShieldCheck": return <ShieldCheck className="w-5 h-5" />;
      case "Flame": return <Flame className="w-5 h-5" />;
      default: return <Award className="w-5 h-5" />;
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setIsCustomLocation(false);
    const defaultLocation = roomLocations[0] || "Main Sanctuary";
    setFormData({
      is_annual_recurring: true,
      title: "",
      description: "",
      ministry_ids: [],
    target_ministry_id: null,
      target_ministry_name: "Church-wide / All Ministries",
      month: new Date().getMonth() + 1,
      week_pattern: "1st_sunday",
      program_highlights: "",
      color: "#2C3968",
      icon: "Award",
      event_date: new Date().toISOString().split("T")[0],
      start_time: "09:00",
      end_time: "11:30",
      location: defaultLocation
    });
    setIsModalOpen(true);
  };

  const handleOpenEditRecurring = (evt: RecurringSundayEvent) => {
    setEditingItem({ type: "recurring", id: evt.id, rawRecurring: evt });
    const loc = roomLocations[0] || "Main Sanctuary";
    setIsCustomLocation(!roomLocations.includes(loc));
    setFormData({
      is_annual_recurring: true,
      title: evt.title,
      description: evt.description || "",
      month: evt.month,
      week_pattern: evt.week_pattern || "1st_sunday",
      ministry_ids: evt.ministry_ids ?? (evt.target_ministry_id ? [evt.target_ministry_id] : []),
      target_ministry_id: evt.target_ministry_id || null,
      target_ministry_name: evt.db_ministry_name || evt.target_ministry_name || "Church-wide / All Ministries",
      color: evt.color || "#2C3968",
      icon: evt.icon || "Award",
      program_highlights: evt.program_highlights || "",
      event_date: evt.projected_date || new Date().toISOString().split("T")[0],
      start_time: "09:00",
      end_time: "12:00",
      location: loc
    });
    setIsModalOpen(true);
  };

  const handleOpenEditOneTime = (evt: EventItem) => {
    setEditingItem({ type: "one_time", id: evt.id, rawOneTime: evt });

    // Extract date and time strings
    let dateStr = new Date().toISOString().split("T")[0];
    let startTimeStr = "09:00";
    let endTimeStr = "11:30";

    try {
      if (evt.start_time) {
        const d = new Date(evt.start_time);
        dateStr = d.toISOString().split("T")[0];
        startTimeStr = d.toTimeString().slice(0, 5);
      }
      if (evt.end_time) {
        const d = new Date(evt.end_time);
        endTimeStr = d.toTimeString().slice(0, 5);
      }
    } catch (e) {
      // fallback
    }

    const eventMonth = new Date(evt.start_time).getMonth() + 1;
    const currentLocation = evt.location || roomLocations[0] || "Main Sanctuary";
    const isCustom = !roomLocations.includes(currentLocation);
    setIsCustomLocation(isCustom);

    setFormData({
      is_annual_recurring: false,
      title: evt.title,
      description: evt.description || "",
      ministry_ids: evt.ministry_ids ?? (evt.ministry_id ? [evt.ministry_id] : []),
      target_ministry_id: evt.ministry_id || null,
      target_ministry_name: evt.ministry_name || "Church-wide / All Ministries",
      month: eventMonth || 1,
      week_pattern: "1st_sunday",
      program_highlights: "",
      color: evt.ministry_color || "#2C3968",
      icon: "Award",
      event_date: dateStr,
      start_time: startTimeStr,
      end_time: endTimeStr,
      location: currentLocation
    });
    setIsModalOpen(true);
  };

  const handleOpenSyncModal = (evt: RecurringSundayEvent) => {
    const defaultSyncLoc = roomLocations[0] || "Main Sanctuary";
    setSyncLocation(defaultSyncLoc);
    setIsSyncCustomLocation(false);
    setSyncStartTime("09:00");
    setSyncEndTime("12:00");
    setSyncingEvent(evt);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("Please enter a title for the event or celebration.");
      return;
    }

    try {
      if (formData.is_annual_recurring) {
        // === SAVING AS ANNUAL RECURRING CELEBRATION ===
        const recurringPayload = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          month: Number(formData.month),
          week_pattern: formData.week_pattern,
          ministry_ids: formData.ministry_ids,
          target_ministry_id: formData.target_ministry_id || null,
          target_ministry_name: formData.target_ministry_name || null,
          color: formData.color,
          icon: formData.icon,
          program_highlights: formData.program_highlights.trim() || null
        };

        if (editingItem?.type === "recurring") {
          await api.updateRecurringSundayEvent(editingItem.id, recurringPayload);
          showToast(`Updated annual celebration '${formData.title}'!`);
        } else {
          // If editing a one-time event and switched to recurring, create recurring definition
          await api.createRecurringSundayEvent(recurringPayload);
          showToast(`Created annual recurring celebration '${formData.title}'!`);
        }
      } else {
        // === SAVING AS ONE-TIME SCHEDULED EVENT ===
        if (!formData.event_date || !formData.start_time || !formData.end_time) {
          alert("Please specify the date, start time, and end time for the scheduled event.");
          return;
        }

        const startDateTime = `${formData.event_date}T${formData.start_time}:00`;
        const endDateTime = `${formData.event_date}T${formData.end_time}:00`;

        if (new Date(endDateTime).getTime() < new Date(startDateTime).getTime()) {
          alert("End time cannot be earlier than start time.");
          return;
        }

        const eventPayload = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          ministry_ids: formData.ministry_ids,
          ministry_id: formData.target_ministry_id || null,
          start_time: startDateTime,
          end_time: endDateTime,
          location: formData.location.trim() || "Main Worship Sanctuary"
        };

        if (editingItem?.type === "one_time") {
          await api.updateEvent(editingItem.id, eventPayload);
          showToast(`Updated scheduled event '${formData.title}'!`);
        } else {
          // Creating new one-time event
          await api.createEvent(eventPayload);
          showToast(`Created new scheduled event '${formData.title}'!`);
        }
      }

      setIsModalOpen(false);
      loadAllEvents();
    } catch (err: any) {
      console.error("Failed to save event:", err);
      alert(err.message || "Failed to save event. Please check your inputs.");
    }
  };

  const handleDeleteRecurring = (id: number, title: string) => {
    const originalCycle = cycleData;
    deleteWithUndo({
      itemName: title,
      itemType: "Sunday celebration",
      onOptimisticDelete: () => {
        if (cycleData) {
          setCycleData({
            ...cycleData,
            events: cycleData.events.filter((e) => e.id !== id),
            total_annual_events: Math.max(0, cycleData.total_annual_events - 1)
          });
        }
      },
      onRestore: () => {
        if (originalCycle) {
          setCycleData(originalCycle);
        }
      },
      onCommitDelete: async () => {
        await api.deleteRecurringSundayEvent(id);
      }
    });
  };

  const handleDeleteOneTime = (id: number, title: string) => {
    const originalEvents = regularEvents;
    deleteWithUndo({
      itemName: title,
      itemType: "Scheduled event",
      onOptimisticDelete: () => {
        setRegularEvents((prev) => prev.filter((e) => e.id !== id));
      },
      onRestore: () => {
        setRegularEvents(originalEvents);
      },
      onCommitDelete: async () => {
        await api.deleteEvent(id);
      }
    });
  };

  const handleScheduleToCalendar = async () => {
    if (!syncingEvent) return;
    try {
      setIsSyncing(true);
      const res = await api.syncRecurringSundayEventToCalendar(syncingEvent.id, {
        year: selectedYear,
        start_time_str: syncStartTime,
        end_time_str: syncEndTime,
        location: syncLocation
      });
      showToast(res.message || `Scheduled on Church Calendar for ${res.formatted_date}!`);
      setSyncingEvent(null);
      loadAllEvents();
    } catch (err: any) {
      console.error("Failed to sync to calendar:", err);
      alert(err.message || "Failed to schedule event on calendar");
    } finally {
      setIsSyncing(false);
    }
  };

  // Process and Filter Data
  const recurringEvents = cycleData?.events || [];

  // Filter Regular Events for Selected Year
  const yearRegularEvents = regularEvents.filter((e) => {
    if (!e.start_time) return false;
    const yr = new Date(e.start_time).getFullYear();
    return yr === selectedYear;
  });

  // Filter Recurring Events
  const filteredRecurring = recurringEvents.filter((evt) => {
    if (selectedTypeFilter === "one_time") return false;

    if (selectedQuarter === "Q1" && !(evt.month >= 1 && evt.month <= 3)) return false;
    if (selectedQuarter === "Q2" && !(evt.month >= 4 && evt.month <= 6)) return false;
    if (selectedQuarter === "Q3" && !(evt.month >= 7 && evt.month <= 9)) return false;
    if (selectedQuarter === "Q4" && !(evt.month >= 10 && evt.month <= 12)) return false;

    if (selectedMinistryFilter !== "all") {
      const minMatch = evt.target_ministry_name?.toLowerCase().includes(selectedMinistryFilter.toLowerCase()) ||
        evt.db_ministry_name?.toLowerCase().includes(selectedMinistryFilter.toLowerCase());
      if (!minMatch) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = evt.title.toLowerCase().includes(q) ||
        (evt.description || "").toLowerCase().includes(q) ||
        (evt.target_ministry_name || "").toLowerCase().includes(q) ||
        MONTH_NAMES[evt.month - 1].toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Filter One-Time Events
  const filteredOneTime = yearRegularEvents.filter((evt) => {
    if (selectedTypeFilter === "recurring") return false;

    const eventMonth = new Date(evt.start_time).getMonth() + 1;

    if (selectedQuarter === "Q1" && !(eventMonth >= 1 && eventMonth <= 3)) return false;
    if (selectedQuarter === "Q2" && !(eventMonth >= 4 && eventMonth <= 6)) return false;
    if (selectedQuarter === "Q3" && !(eventMonth >= 7 && eventMonth <= 9)) return false;
    if (selectedQuarter === "Q4" && !(eventMonth >= 10 && eventMonth <= 12)) return false;

    if (selectedMinistryFilter !== "all") {
      const minMatch = evt.ministry_name?.toLowerCase().includes(selectedMinistryFilter.toLowerCase());
      if (!minMatch) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = evt.title.toLowerCase().includes(q) ||
        (evt.description || "").toLowerCase().includes(q) ||
        (evt.location || "").toLowerCase().includes(q) ||
        (evt.ministry_name || "").toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  const celebrationPage = useListPagination([...filteredRecurring.map(evt => ({ kind: "recurring", id: evt.id })), ...filteredOneTime.map(evt => ({ kind: "one_time", id: evt.id }))], JSON.stringify([selectedYear, selectedTypeFilter, selectedQuarter, selectedMinistryFilter, searchQuery]));
  const visibleRecurring = filteredRecurring.filter(evt => celebrationPage.items.some(item => item.kind === "recurring" && item.id === evt.id));
  const visibleOneTime = filteredOneTime.filter(evt => celebrationPage.items.some(item => item.kind === "one_time" && item.id === evt.id));
  const totalCount = filteredRecurring.length + filteredOneTime.length;
  const guideData = useGuideDataState("celebrations", { loading, count: totalCount, filtered: recurringEvents.length + regularEvents.length > 0 || Boolean(searchQuery), retry: loadAllEvents });
  const syncedCount = recurringEvents.filter(e => e.is_synced_to_calendar).length;

  return (
    <div className="celebrations-page space-y-5 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">

      {/* ==================================================== */}
      {/* TOP HERO BANNER & YEAR SELECTOR */}
      {/* ==================================================== */}
      <PageHeader icon={<Calendar />} title={<>Events and Celebrations</>}
        description={<>Plan church gatherings and annual milestones, year after year.</>}
        actions={<><div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {/* Year Switcher Pills */}
          <div data-guide="celebration-year" className="celebrations-segment flex items-center p-1 rounded-xl" aria-label="Select year">
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((yr) => (
              <button
                key={yr}
                aria-pressed={selectedYear === yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${selectedYear === yr
                  ? "bg-amber-400 text-indigo-950 shadow-sm scale-105"
                  : "text-charcoal hover:text-charcoal hover:bg-stone-50"
                  }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {isAdminOrCoordinator && (
            <Button data-guide="celebration-new" onClick={handleOpenAdd} variant="secondary">
              <Plus className="w-4 h-4" />
              <span>Add Event / Celebration</span>
            </Button>
          )}
        </div></>} />

      {/* ==================================================== */}
      {/* 12-MONTH VISUAL ROADMAP STRIP */}
      {/* ==================================================== */}
      {loading ? <div role="status" aria-busy="true" aria-label="Loading year overview..." className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4"><Skeleton className="h-6 w-44" /><div className="grid grid-cols-2 sm:grid-cols-6 gap-3">{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div></div> : (<section className="celebrations-overview rounded-2xl p-4 sm:p-5 space-y-4" aria-label="Year at a glance">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-indigo-950">
                {selectedYear} at a glance
              </h3>
              <p className="text-[12px] text-muted">
                Annual celebrations and scheduled events across the year
              </p>
            </div>
          </div>

          <div className="celebrations-totals flex items-center gap-3 text-xs flex-wrap">
            <span className="bg-amber-50 text-amber-900 font-medium px-2.5 py-1 rounded-xl border border-amber-200 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-amber-600" />
              <span>{recurringEvents.length} Annual Celebrations</span>
            </span>
            <span className="bg-indigo-50 text-indigo-950 font-medium px-2.5 py-1 rounded-xl border border-indigo-200 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
              <span>{yearRegularEvents.length} Scheduled Events</span>
            </span>
            <span className="bg-emerald-50 text-emerald-800 font-medium px-2.5 py-1 rounded-xl border border-emerald-200"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> {syncedCount} Synced
            </span>
          </div>
        </div>

        {/* 12 Months Horizontal Scroll Grid */}
        <div className="celebrations-months grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {MONTH_NAMES.map((mName, idx) => {
            const mNum = idx + 1;
            const monthRecurring = recurringEvents.filter((e) => e.month === mNum);
            const monthOneTime = yearRegularEvents.filter((e) => {
              const d = new Date(e.start_time);
              return d.getMonth() + 1 === mNum;
            });
            const monthItemCount = monthRecurring.length + monthOneTime.length;
            const isCurrentMonth = new Date().getMonth() + 1 === mNum && new Date().getFullYear() === selectedYear;

            return (
              <div
                key={mNum}
                data-current-month={isCurrentMonth}
                className={`celebrations-month p-3 rounded-xl border transition-all flex flex-col space-y-2 ${isCurrentMonth
                    ? "bg-amber-50/50 border-amber-400 ring-2 ring-amber-400/20 shadow-xs"
                    : monthItemCount > 0
                      ? "bg-ivory-light/60 border-indigo-100 hover:border-amber-300"
                      : "bg-gray-50/50 border-gray-100 opacity-60"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[12px] font-medium uppercase tracking-wider ${isCurrentMonth ? "text-amber-800" : "text-indigo-950"}`}>
                    {mName}
                  </span>
                  {monthItemCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-indigo-950 text-white text-[12px] font-medium flex items-center justify-center">
                      {monthItemCount}
                    </span>
                  )}
                </div>

                {monthItemCount > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5 custom-scrollbar">
                    {/* Recurring Celebrations */}
                    {monthRecurring.map((me) => (
                      <div
                        key={`rec-${me.id}`}
                        className="celebrations-month-entry p-2 rounded-lg text-xs leading-tight"
                        title={`[Annual] ${me.title} — ${me.projected_formatted}`}
                      >
                        <div className="font-medium text-amber-950 truncate flex items-center gap-1">
                          <Repeat className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          <span className="truncate">{me.title}</span>
                        </div>
                        <div className="text-[12px] text-amber-800/70 flex items-center justify-between mt-0.5">
                          <span>{me.projected_formatted?.split(",")[0]}</span>
                          {me.is_synced_to_calendar && (
                            <span className="text-emerald-700 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Cal</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* One-Time Events */}
                    {monthOneTime.map((oe) => {
                      const d = new Date(oe.start_time);
                      const formattedDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      return (
                        <div
                          key={`one-${oe.id}`}
                          className="celebrations-month-entry p-2 rounded-lg text-xs leading-tight"
                          title={`[Event] ${oe.title} — ${formattedDay}`}
                        >
                          <div className="font-medium text-indigo-950 truncate flex items-center gap-1">
                            <CalendarDays className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                            <span className="truncate">{oe.title}</span>
                          </div>
                          <div className="text-[12px] text-muted flex items-center justify-between mt-0.5">
                            <span>{formattedDay}</span>
                            <span className="text-indigo-600 font-medium">{oe.location ? <><UIMapPin aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /></> : ""}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[12px] text-muted italic py-1">No events scheduled</div>
                )}
              </div>
            );
          })}
        </div>
      </section>)}

      {/* ==================================================== */}
      {/* FILTER & SEARCH CONTROLS */}
      {/* ==================================================== */}
      <FilterPanel title="Event filters" summary={[selectedTypeFilter === "all" ? "All event types" : selectedTypeFilter.replace(/_/g, " "), selectedQuarter === "all" ? "All year" : selectedQuarter, selectedMinistryFilter !== "all" && selectedMinistryFilter, searchQuery].filter(Boolean).join(" · ")}>
        <div className="filter-panel-layout celebrations-filters flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 p-4 rounded-2xl">

        {/* Event Type & Quarter Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter */}
          <div data-guide="celebration-type-filter" className="celebrations-segment flex items-center gap-1 p-1 rounded-xl">
            <button
              onClick={() => setSelectedTypeFilter("all")}
              aria-pressed={selectedTypeFilter === "all"}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${selectedTypeFilter === "all"
                  ? "bg-indigo-950 text-white shadow-xs"
                  : "text-charcoal/70 hover:text-charcoal hover:bg-white"
                }`}
            >
              All Types ({recurringEvents.length + yearRegularEvents.length})
            </button>
            <button
              onClick={() => setSelectedTypeFilter("recurring")}
              aria-pressed={selectedTypeFilter === "recurring"}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${selectedTypeFilter === "recurring"
                  ? "bg-amber-500 text-indigo-950 shadow-xs"
                  : "text-charcoal/70 hover:text-charcoal hover:bg-white"
                }`}
            >
              <Repeat className="w-3.5 h-3.5 text-amber-700" />
              <span>Annual Celebrations ({recurringEvents.length})</span>
            </button>
            <button
              onClick={() => setSelectedTypeFilter("one_time")}
              aria-pressed={selectedTypeFilter === "one_time"}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${selectedTypeFilter === "one_time"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-charcoal/70 hover:text-charcoal hover:bg-white"
                }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>One-Time Events ({yearRegularEvents.length})</span>
            </button>
          </div>

          {/* Quarter Filter Chips */}
          <div className="celebrations-segment flex items-center gap-1 p-1 rounded-xl" aria-label="Filter by quarter">
            {[
              { id: "all", label: "All Year" },
              { id: "Q1", label: "Q1" },
              { id: "Q2", label: "Q2" },
              { id: "Q3", label: "Q3" },
              { id: "Q4", label: "Q4" },
            ].map((tab) => (
              <button
                key={tab.id}
                aria-pressed={selectedQuarter === tab.id}
                onClick={() => setSelectedQuarter(tab.id as any)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${selectedQuarter === tab.id
                    ? "bg-indigo-950 text-white shadow-xs"
                    : "text-charcoal/70 hover:text-charcoal hover:bg-white"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Ministry Filter */}
        <div className="celebrations-search flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input data-guide="celebration-search"
              aria-label="Search events and celebrations"
              type="text"
              placeholder="Search events, theme, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-9 pr-3.5 py-2 rounded-xl bg-ivory-light border border-indigo-100 focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo w-52 sm:w-64"
            />
          </div>

          <select
            aria-label="Filter by ministry"
            value={selectedMinistryFilter}
            onChange={(e) => setSelectedMinistryFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-ivory-light border border-indigo-100 font-medium text-charcoal focus:outline-hidden"
          >
            <option value="all">All Ministries</option>
            <option value="Church-wide">Church-wide</option>
            {ministries.map((m) => (
              <option key={m.id} value={m.name}>{m.name} Ministry</option>
            ))}
          </select>
        </div>
      </div>
      </FilterPanel>

      {/* ==================================================== */}
      {/* EVENTS & CELEBRATIONS CARDS GRID */}
      {/* ==================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-indigo-950">Events in {selectedYear} <span className="text-muted font-normal ml-2">{totalCount} results</span></h2>
        {(searchQuery || selectedQuarter !== "all" || selectedTypeFilter !== "all" || selectedMinistryFilter !== "all") && <button type="button"
          className="text-xs text-indigo-700 font-medium px-3 py-2 rounded-lg hover:bg-indigo-50"
          onClick={() => { setSearchQuery(""); setSelectedQuarter("all"); setSelectedTypeFilter("all"); setSelectedMinistryFilter("all"); }}>Clear filters</button>}
      </div>
      {loading ? (
        <div role="status" aria-busy="true" aria-label="Loading events and celebrations..."><CardGridSkeleton count={6} columns={3} /></div>
      ) : totalCount === 0 ? (
        <div className="bg-white/95 rounded-2xl p-12 border border-stone-200 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-2xs">
            <Calendar className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-semibold text-indigo-950">No Events or Celebrations Found</h4>
          <p className="text-xs text-muted max-w-md mx-auto">
            {searchQuery
              ? `No entries matching "${searchQuery}".`
              : "No events or celebrations match your selected filters."}
          </p>
          {isAdminOrCoordinator && (
            <button data-guide="celebration-new"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-950 text-white rounded-xl text-xs font-medium shadow-xs hover:bg-indigo-900 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Create Event or Celebration</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* 1. RECURRING ANNUAL SUNDAY CELEBRATIONS */}
          {visibleRecurring.map((evt) => (
            <div
              key={`recurring-${evt.id}`}
              className="celebration-card group rounded-2xl overflow-hidden flex flex-col justify-between"
            >
              {/* Top Accent Strip */}
              <div
                className="celebration-card-accent h-1 w-full"
                style={{ backgroundColor: evt.color || "#2C3968" }}
              />

              <div className="p-5 sm:p-6 space-y-4">

                {/* Event Header & Recurrence Badge */}
                <div className="celebration-card-heading flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="celebration-card-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    >
                      {getEventIcon(evt.icon)}
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80 mb-1">
                        <Repeat className="w-3 h-3" />
                        <span>Annual Celebration</span>
                      </div>
                      <h3 className="text-base font-semibold text-indigo-950 leading-snug group-hover:text-amber-600 transition-colors">
                        {evt.title}
                      </h3>
                    </div>
                  </div>

                  {evt.is_synced_to_calendar ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-lg shrink-0">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Scheduled</span>
                    </span>
                  ) : null}
                </div>

                {/* Projected Sunday Date Card */}
                <div className="celebration-date p-3 rounded-xl flex flex-wrap gap-2 items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-indigo-950 font-medium">
                    <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Target: <strong>{evt.projected_formatted}</strong></span>
                  </div>
                  <span className="text-[12px] font-medium text-amber-800 bg-amber-100/60 px-2 py-0.5 rounded-lg border border-amber-200">
                    {getWeekPatternLabel(evt.week_pattern)}
                  </span>
                </div>

                {/* Description */}
                {evt.description && (
                  <p className="text-xs text-charcoal/70 line-clamp-2 leading-relaxed">
                    {evt.description}
                  </p>
                )}

                {/* Program Highlights & Ministry Info */}
                <div className="space-y-2 pt-2 border-t border-indigo-50 text-xs">
                  {evt.program_highlights && (
                    <div className="flex items-start gap-2 text-charcoal/80">
                      <Award className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="text-[12px] line-clamp-2">
                        <strong>Highlights:</strong> {evt.program_highlights}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-indigo-950 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{evt.db_ministry_name || evt.target_ministry_name || "Church-wide"}</span>
                    </span>
                  </div>
                </div>

              </div>

              {/* Bottom Actions Toolbar */}
              <div className="celebration-actions px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                {isAdminOrCoordinator ? (
                  <>
                    <button data-guide="celebration-sync"
                      onClick={() => handleOpenSyncModal(evt)}
                      disabled={evt.is_synced_to_calendar}
                      className={`text-xs font-medium px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${evt.is_synced_to_calendar
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300 opacity-80 cursor-default"
                          : "bg-indigo-950 hover:bg-indigo-900 text-white shadow-xs"
                        }`}
                    >
                      {evt.is_synced_to_calendar ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>On Calendar</span>
                        </>
                      ) : (
                        <>
                          <Calendar className="w-3.5 h-3.5 text-amber-300" />
                          <span>Schedule on Calendar</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditRecurring(evt)}
                        className="p-1.5 rounded-xl hover:bg-indigo-100 text-charcoal/70 hover:text-indigo-950 transition-colors cursor-pointer"
                        title="Edit Celebration"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecurring(evt.id, evt.title)}
                        className="p-1.5 rounded-xl hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                        title="Delete Celebration"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="text-[12px] font-medium text-muted">
                    Annual celebration scheduled every {getWeekPatternLabel(evt.week_pattern)}
                  </span>
                )}
              </div>

            </div>
          ))}

          {/* 2. ONE-TIME SCHEDULED EVENTS */}
          {visibleOneTime.map((evt) => {
            const startDate = new Date(evt.start_time);
            const endDate = new Date(evt.end_time);
            const dateFormatted = startDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric"
            });
            const startTimeFormatted = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
            const endTimeFormatted = endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

            return (
              <div
                key={`one_time-${evt.id}`}
                className="celebration-card group rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                {/* Top Accent Strip */}
                <div
                  className="celebration-card-accent h-1 w-full"
                  style={{ backgroundColor: evt.ministry_color || "#2C3968" }}
                />

                <div className="p-5 sm:p-6 space-y-4">

                  {/* Event Header & One-time Badge */}
                  <div className="celebration-card-heading flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="celebration-card-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      >
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/80 mb-1">
                          <Clock className="w-3 h-3" />
                          <span>One-Time Event</span>
                        </div>
                        <h3 className="text-base font-semibold text-indigo-950 leading-snug group-hover:text-indigo-600 transition-colors">
                          {evt.title}
                        </h3>
                      </div>
                    </div>

                    {evt.rsvp_count !== undefined && evt.rsvp_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-800 bg-indigo-100/80 border border-indigo-300 px-2 py-0.5 rounded-lg shrink-0">
                        <Users className="w-3 h-3 text-indigo-600" />
                        <span>{evt.rsvp_count} RSVP</span>
                      </span>
                    )}
                  </div>

                  {/* Scheduled Date & Time Card */}
                  <div className="celebration-date p-3 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-indigo-950 font-medium">
                      <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{dateFormatted}</span>
                    </div>
                    <div className="flex items-center gap-2 text-charcoal/70 font-medium text-[12px]">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{startTimeFormatted} – {endTimeFormatted}</span>
                    </div>
                  </div>

                  {/* Location / Venue */}
                  {evt.location && (
                    <div className="flex items-center gap-2 text-xs text-charcoal/80 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                      <span className="font-medium truncate">{evt.location}</span>
                    </div>
                  )}

                  {/* Description */}
                  {evt.description && (
                    <p className="text-xs text-charcoal/70 line-clamp-2 leading-relaxed">
                      {evt.description}
                    </p>
                  )}

                  {/* Ministry Info */}
                  <div className="pt-2 border-t border-indigo-50 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-indigo-950 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{evt.ministry_name || "Church-wide Gathering"}</span>
                    </span>

                    {evt.creator_name && (
                      <span className="text-[12px] text-muted">
                        By {evt.creator_name}
                      </span>
                    )}
                  </div>

                </div>

                {/* Bottom Actions Toolbar */}
                <div className="celebration-actions px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  {isAdminOrCoordinator ? (
                    <>
                      <div className="text-[12px] font-medium text-muted">
                        Scheduled Gathering
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditOneTime(evt)}
                          className="p-1.5 rounded-xl hover:bg-indigo-100 text-charcoal/70 hover:text-indigo-950 transition-colors cursor-pointer"
                          title="Edit Event"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOneTime(evt.id, evt.title)}
                          className="p-1.5 rounded-xl hover:bg-rose-100 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="text-[12px] font-medium text-muted">
                      Church event at {evt.location || "Sanctuary"}
                    </span>
                  )}
                </div>

              </div>
            );
          })}

        </div>
      )}

      {/* ==================================================== */}
      {/* ADD / EDIT EVENT OR CELEBRATION MODAL */}
      {/* ==================================================== */}
      <Pagination label="celebrations" page={celebrationPage.page} pageSize={celebrationPage.pageSize} total={celebrationPage.total} onPageChange={celebrationPage.setPage} onPageSizeChange={celebrationPage.setPageSize} loading={loading} />

      {isModalOpen && (
        <ViewportOverlay className="bg-charcoal/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-xl w-full my-auto shadow-2xl border border-indigo-100 animate-in fade-in zoom-in duration-200 overflow-hidden">

            {/* Modal Header */}
            <div data-modal-header className="p-5 sm:p-6 bg-indigo-950 text-white flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-amber-200 text-[12px] font-medium uppercase tracking-wider mb-1">
                  {formData.is_annual_recurring ? <><UIRefreshCw aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Annual Celebration</> : <><UICalendarDays aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> One-Time Event</>}
                </div>
                <h3 className="text-lg font-semibold">
                  {editingItem ? "Edit Event / Celebration" : "Create Event / Celebration"}
                </h3>
                <p className="text-xs text-indigo-100/80 mt-0.5">
                  Choose whether this is an annual recurring celebration or a one-time scheduled event
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form data-guide="celebration-form" onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">

              {/* ==================================================== */}
              {/* RECURRENCE TYPE SELECTOR (TOGGLE / RADIO) */}
              {/* ==================================================== */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-indigo-950">
                  Event Category & Recurrence Type *
                </label>
                <div data-guide="celebration-kind" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Annual Recurring Celebration */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_annual_recurring: true })}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${formData.is_annual_recurring
                        ? "border-amber-500 bg-amber-50/70 shadow-sm ring-2 ring-amber-400/20"
                        : "border-gray-200 bg-white hover:border-gray-300 opacity-70"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-950">
                        <Repeat className="w-4 h-4 text-amber-600" />
                        <span>Annual Recurring Celebration</span>
                      </span>
                      {formData.is_annual_recurring && (
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                    <p className="text-[12px] text-charcoal/70 leading-relaxed">
                      Repeats every year on a designated Sunday (e.g. Anniversary, Mother's Day, Water Baptism, Christmas).
                    </p>
                  </button>

                  {/* Option 2: One-Time Scheduled Event */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_annual_recurring: false })}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${!formData.is_annual_recurring
                        ? "border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-400/20"
                        : "border-gray-200 bg-white hover:border-gray-300 opacity-70"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-indigo-950">
                        <CalendarDays className="w-4 h-4 text-indigo-600" />
                        <span>One-Time Scheduled Event</span>
                      </span>
                      {!formData.is_annual_recurring && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      )}
                    </div>
                    <p className="text-[12px] text-charcoal/70 leading-relaxed">
                      A specific church activity with a set date, time, and sanctuary venue (e.g. Fellowship, Seminar, Outreach).
                    </p>
                  </button>
                </div>
              </div>

              {/* Title Field */}
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">
                  {formData.is_annual_recurring ? "Celebration Title *" : "Event Title *"}
                </label>
                <input data-guide="celebration-title"
                  type="text"
                  required
                  placeholder={
                    formData.is_annual_recurring
                      ? "e.g., Grand Church Anniversary Sunday"
                      : "e.g., Youth Leadership Summit & Worship Night"
                  }
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                />
              </div>

              {/* ==================================================== */}
              {/* CONDITIONAL FIELDS: ANNUAL RECURRING CELEBRATION */}
              {/* ==================================================== */}
              {formData.is_annual_recurring ? (
                <div className="space-y-3.5 p-4 rounded-2xl bg-amber-50/40 border border-amber-200/60 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-amber-950 mb-1">
                        Month of the Year *
                      </label>
                      <select
                        value={formData.month}
                        onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value, 10) })}
                        className="w-full text-xs p-2.5 rounded-xl border border-amber-200 bg-white focus:outline-hidden"
                      >
                        {MONTH_NAMES.map((name, i) => (
                          <option key={i + 1} value={i + 1}>{name} (Month {i + 1})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-amber-950 mb-1">
                        Sunday Rule Pattern *
                      </label>
                      <select
                        value={formData.week_pattern}
                        onChange={(e) => setFormData({ ...formData, week_pattern: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-xl border border-amber-200 bg-white focus:outline-hidden"
                      >
                        <option value="1st_sunday">1st Sunday of the Month</option>
                        <option value="2nd_sunday">2nd Sunday of the Month</option>
                        <option value="3rd_sunday">3rd Sunday of the Month</option>
                        <option value="4th_sunday">4th Sunday of the Month</option>
                        <option value="last_sunday">Last Sunday of the Month</option>
                      </select>
                    </div>
                  </div>

                  {/* Sanctuary / Venue / Meeting Room */}
                  <div>
                    <label className="block text-xs font-medium text-amber-950 mb-1 flex items-center justify-between">
                      <span>Sanctuary / Venue / Meeting Room *</span>
                      <span className="text-[12px] font-medium text-muted">From Settings / Custom</span>
                    </label>
                    <div className="space-y-2">
                      <select data-guide="celebration-location"
                        value={
                          roomLocations.includes(formData.location) && !isCustomLocation
                            ? formData.location
                            : "__custom__"
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__custom__") {
                            setIsCustomLocation(true);
                            if (roomLocations.includes(formData.location)) {
                              setFormData({ ...formData, location: "" });
                            }
                          } else {
                            setIsCustomLocation(false);
                            setFormData({ ...formData, location: val });
                          }
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border border-amber-200 bg-white focus:outline-hidden font-medium text-charcoal"
                      >
                        <optgroup label="Meeting Rooms & Venues (Settings)">
                          {roomLocations.map((loc) => (
                            <option key={loc} value={loc}> {loc}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Custom / Other">
                          <option value="__custom__"> Other / Type Custom Venue Manually...</option>
                        </optgroup>
                      </select>

                      {isCustomLocation && (
                        <div className="animate-in fade-in duration-150">
                          <input data-guide="celebration-location"
                            type="text"
                            required
                            autoFocus
                            placeholder="Enter custom venue (e.g. Main Sanctuary, Camp Grounds, Zoom)"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full text-xs p-2.5 rounded-xl border border-amber-400 bg-amber-50/50 focus:outline-hidden focus:ring-2 focus:ring-amber-400/20 text-charcoal font-medium"
                          />
                          <p className="text-[12px] text-muted mt-1">
                            Type any custom sanctuary, room, or external meeting location.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-charcoal mb-1">
                      Program Highlights & Special Elements
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Special Song, Gift Giving, Floral Tokens, Agape Fellowship Meal"
                      value={formData.program_highlights}
                      onChange={(e) => setFormData({ ...formData, program_highlights: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-white focus:outline-hidden"
                    />
                  </div>
                </div>
              ) : (
                /* ==================================================== */
                /* CONDITIONAL FIELDS: ONE-TIME SCHEDULED EVENT */
                /* ==================================================== */
                <div className="space-y-3.5 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-200/60 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-medium text-indigo-950 mb-1">
                      Event Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.event_date}
                      onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-indigo-200 bg-white focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-indigo-950 mb-1">
                        Start Time *
                      </label>
                      <input
                        type="time"
                        required
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-xl border border-indigo-200 bg-white focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-indigo-950 mb-1">
                        End Time *
                      </label>
                      <input
                        type="time"
                        required
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-xl border border-indigo-200 bg-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-indigo-950 mb-1 flex items-center justify-between">
                      <span>Sanctuary / Venue / Meeting Room *</span>
                      <span className="text-[12px] font-medium text-muted">From Settings / Custom</span>
                    </label>
                    <div className="space-y-2">
                      <select data-guide="celebration-location"
                        value={
                          roomLocations.includes(formData.location) && !isCustomLocation
                            ? formData.location
                            : "__custom__"
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__custom__") {
                            setIsCustomLocation(true);
                            if (roomLocations.includes(formData.location)) {
                              setFormData({ ...formData, location: "" });
                            }
                          } else {
                            setIsCustomLocation(false);
                            setFormData({ ...formData, location: val });
                          }
                        }}
                        className="w-full text-xs p-2.5 rounded-xl border border-indigo-200 bg-white focus:outline-hidden font-medium text-charcoal"
                      >
                        <optgroup label="Meeting Rooms & Venues (Settings)">
                          {roomLocations.map((loc) => (
                            <option key={loc} value={loc}> {loc}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Custom / Other">
                          <option value="__custom__"> Other / Type Custom Venue Manually...</option>
                        </optgroup>
                      </select>

                      {isCustomLocation && (
                        <div className="animate-in fade-in duration-150">
                          <input data-guide="celebration-location"
                            type="text"
                            required
                            autoFocus
                            placeholder="Enter custom venue (e.g. Riverside Camp, Function Hall, Zoom)"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full text-xs p-2.5 rounded-xl border border-amber-400 bg-amber-50/50 focus:outline-hidden focus:ring-2 focus:ring-amber-400/20 text-charcoal font-medium"
                          />
                          <p className="text-[12px] text-muted mt-1">
                            Type any custom sanctuary, room, or external meeting location.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <EventMinistryPicker ministries={ministries} value={formData.ministry_ids} onChange={ids => setFormData({
                ...formData, ministry_ids: ids, target_ministry_id: ids[0] || null,
                target_ministry_name: ids.length ? ministries.filter(m => ids.includes(m.id)).map(m => m.name).join(' + ') : 'Church-wide / All Ministries'
              })} />

              {/* Description & Pastoral Purpose */}
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">
                  Description & Event Details
                </label>
                <textarea
                  rows={3}
                  placeholder="Details, pastoral guidelines, or special announcements for this gathering..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-hidden"
                />
              </div>

              {/* Modal Buttons */}
              <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-charcoal/70 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button data-guide="celebration-save"
                  type="submit"
                  className="px-5 py-2 bg-indigo-900 hover:bg-indigo-950 text-white font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {editingItem ? "Save Changes" : formData.is_annual_recurring ? "Create Annual Celebration" : "Create Scheduled Event"}
                </button>
              </div>

            </form>
          </ModalPanel>
        </ViewportOverlay>
      )}

      {/* ==================================================== */}
      {/* SCHEDULE ON MAIN EVENTS CALENDAR MODAL (for Annual recurring) */}
      {/* ==================================================== */}
      {syncingEvent && (
        <ViewportOverlay className="bg-charcoal/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full my-auto shadow-2xl border border-indigo-100 animate-in fade-in zoom-in duration-200 p-6 space-y-4">

            <div data-modal-header className="flex items-start justify-between gap-3 pb-3 border-b border-indigo-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-indigo-950">
                    Schedule on Church Calendar
                  </h3>
                  <p className="text-[12px] text-muted">
                    Target Date: <strong>{syncingEvent.projected_formatted}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSyncingEvent(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-muted cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-ivory-light/80 rounded-2xl border border-indigo-50 space-y-1">
                <div className="font-medium text-indigo-950">{syncingEvent.title}</div>
                <div className="text-[12px] text-charcoal/70">{syncingEvent.theme_tagline}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-charcoal mb-1">Start Time</label>
                  <input
                    type="time"
                    value={syncStartTime}
                    onChange={(e) => setSyncStartTime(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-charcoal mb-1">End Time</label>
                  <input
                    type="time"
                    value={syncEndTime}
                    onChange={(e) => setSyncEndTime(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-charcoal mb-1 flex items-center justify-between">
                  <span>Sanctuary / Venue / Meeting Room</span>
                  <span className="text-[12px] text-muted">From Settings / Custom</span>
                </label>
                <div className="space-y-2">
                  <select
                    value={
                      roomLocations.includes(syncLocation) && !isSyncCustomLocation
                        ? syncLocation
                        : "__custom__"
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__custom__") {
                        setIsSyncCustomLocation(true);
                        if (roomLocations.includes(syncLocation)) {
                          setSyncLocation("");
                        }
                      } else {
                        setIsSyncCustomLocation(false);
                        setSyncLocation(val);
                      }
                    }}
                    className="w-full text-xs p-2 rounded-xl border border-gray-200 bg-white"
                  >
                    <optgroup label="Meeting Rooms (Settings)">
                      {roomLocations.map((loc) => (
                        <option key={loc} value={loc}> {loc}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Custom">
                      <option value="__custom__"> Other / Type Custom Venue...</option>
                    </optgroup>
                  </select>

                  {isSyncCustomLocation && (
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Enter custom room or venue name..."
                      value={syncLocation}
                      onChange={(e) => setSyncLocation(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-amber-300 bg-amber-50/50"
                    />
                  )}
                </div>
              </div>
            </div>

            <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setSyncingEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-charcoal/70 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button data-guide="celebration-sync-save"
                onClick={handleScheduleToCalendar}
                disabled={isSyncing}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? "Scheduling..." : "Confirm & Schedule"}
              </button>
            </div>

          </ModalPanel>
        </ViewportOverlay>
      )}



    </div>
  );
};

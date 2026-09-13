import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { 
  EventItem, BirthdayCelebrant, SaturdayDutyScheduleItem, 
  SundayDutyScheduleItem, BibleStudyGroup, Ministry 
} from "../types";
import {
  Calendar as CalendarIcon, Plus, MapPin, Clock, Users,
  CheckCircle2, ChevronLeft, ChevronRight, Filter, Search,
  Layers, LayoutGrid, List, X, Sparkles, AlertCircle,
  Cake, Gift, PartyPopper, Send, Check, Utensils, CalendarCheck,
  BookOpen, ShieldCheck, Droplets, ChevronRight as ChevronRightIcon,
  Crown, Phone, ExternalLink, Sparkle, Tag, ChevronDown, ChevronUp
} from "lucide-react";
import { DateTimePickerInput } from "../components/common/DateTimePickerInput";
import { useSocketEvent } from "../socket";
import { EventsPageSkeleton } from "../components/common/SkeletonLoader";
import { ConfirmationModal, ModalType } from "../components/common/ConfirmationModal";

// Dynamic default dates helper for "Now" & "Now + 2 Hours"
const getNowIsoLocal = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const getNowPlusHoursIsoLocal = (hours: number = 2): string => {
  const now = new Date();
  now.setHours(now.getHours() + hours);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

// Deterministic time and date formatters to prevent timezone discrepancies
const formatTime12h = (timeStr?: string): string => {
  if (!timeStr) return "";
  try {
    if (timeStr.includes("T")) {
      const timePart = timeStr.split("T")[1];
      if (timePart) {
        const [hStr, mStr] = timePart.split(":");
        let h = parseInt(hStr, 10);
        let m = parseInt(mStr, 10);
        if (!isNaN(h) && !isNaN(m)) {
          const period = h >= 12 ? "PM" : "AM";
          if (h === 0) h = 12;
          else if (h > 12) h -= 12;
          return `${h}:${String(m).padStart(2, "0")} ${period}`;
        }
      }
    }
    if (timeStr.includes("AM") || timeStr.includes("PM")) {
      return timeStr;
    }
    if (timeStr.includes(":")) {
      const [hStr, mStr] = timeStr.split(":");
      let h = parseInt(hStr, 10);
      let m = parseInt(mStr, 10);
      if (!isNaN(h) && !isNaN(m)) {
        const period = h >= 12 ? "PM" : "AM";
        if (h === 0) h = 12;
        else if (h > 12) h -= 12;
        return `${h}:${String(m).padStart(2, "0")} ${period}`;
      }
    }
  } catch {}
  return timeStr;
};

const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return "";
  try {
    const [yyyy, mm, dd] = dateStr.split("-").map(Number);
    if (yyyy && mm && dd) {
      const d = new Date(yyyy, mm - 1, dd);
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    }
  } catch {}
  return dateStr;
};

// Unified Activity Interface
export interface UnifiedActivity {
  id: string;
  type: "church_event" | "saturday_duty" | "dishwashing" | "bible_study" | "birthday";
  title: string;
  date_str: string; // YYYY-MM-DD (start date)
  end_date_str?: string; // YYYY-MM-DD (end date for multi-day events)
  is_multiday?: boolean;
  start_time_iso?: string;
  end_time_iso?: string;
  time_formatted: string;
  location?: string;
  ministry_id?: number | null;
  ministry_name?: string;
  ministry_color?: string;
  leader_name?: string;
  leader_phone?: string;
  badge_color: string;
  description?: string;
  status?: string;
  rsvp_count?: number;
  members_count?: number;
  checklist?: string;
  raw_data: any;
}

export type ActivityTypeFilter = "all" | "church_event" | "saturday_duty" | "dishwashing" | "bible_study" | "birthday";

// Helper to test if an activity is active on a given calendar date
const isActivityOnDate = (act: UnifiedActivity, dateStr: string): boolean => {
  const start = act.date_str;
  const end = act.end_date_str || act.date_str;
  return dateStr >= start && dateStr <= end;
};

export const EventsPage: React.FC = () => {
  const { user, ministries, allowedMinistries, isRestricted, selectedMinistryId } = useAuth();

  // Raw data collections
  const [events, setEvents] = useState<EventItem[]>([]);
  const [saturdayDuties, setSaturdayDuties] = useState<SaturdayDutyScheduleItem[]>([]);
  const [dishwashingDuties, setDishwashingDuties] = useState<SundayDutyScheduleItem[]>([]);
  const [bibleStudyGroups, setBibleStudyGroups] = useState<BibleStudyGroup[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayCelebrant[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Navigation
  const initialMinistry = isRestricted && allowedMinistries.length > 0
    ? String(allowedMinistries[0].id)
    : (selectedMinistryId ? String(selectedMinistryId) : "");

  const [filterMinistry, setFilterMinistry] = useState<string>(initialMinistry);
  const [filterType, setFilterType] = useState<ActivityTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"calendar" | "agenda">("calendar");

  // Calendar navigation state (defaults dynamically to current month)
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Inspector & Modals state
  const [selectedActivity, setSelectedActivity] = useState<UnifiedActivity | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBirthday, setSelectedBirthday] = useState<BirthdayCelebrant | null>(null);
  const [dayPopover, setDayPopover] = useState<{
    dateStr: string;
    x: number;
    y: number;
    activities: UnifiedActivity[];
  } | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});
  const [greetingMessage, setGreetingMessage] = useState<string>("");
  const [greetingSuccess, setGreetingSuccess] = useState<boolean>(false);
  const [sendingGreeting, setSendingGreeting] = useState<boolean>(false);

  // Custom Confirmation & Alert Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    type: ModalType;
    confirmText?: string;
    cancelText?: string | null;
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
    confirmText: "Okay",
    onConfirm: () => {}
  });

  const showAlert = (title: string, message: string, type: ModalType = "danger") => {
    setConfirmModalConfig({
      isOpen: true,
      title,
      type,
      confirmText: "Okay",
      cancelText: null,
      description: <p className="text-xs text-charcoal/80 text-center">{message}</p>,
      onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Helper to open floating day popover
  const handleOpenDayPopover = (e: React.MouseEvent, dateStr: string) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const allDayActs = filteredActivities.filter(a => isActivityOnDate(a, dateStr));
    setDayPopover({
      dateStr,
      x: rect.left + rect.width / 2,
      y: rect.top,
      activities: allDayActs
    });
  };

  // New Event Form Data (defaulted to current date & time)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    ministry_id: isRestricted && allowedMinistries.length > 0 ? String(allowedMinistries[0].id) : "",
    start_time: getNowIsoLocal(),
    end_time: getNowPlusHoursIsoLocal(2),
    location: "Main Sanctuary"
  });

  // Open Create Modal with dynamic defaults (or preset date)
  const handleOpenCreateModal = (presetDateStr?: string) => {
    const start = presetDateStr 
      ? `${presetDateStr}T${getNowIsoLocal().split("T")[1]}` 
      : getNowIsoLocal();
    const end = presetDateStr 
      ? `${presetDateStr}T${getNowPlusHoursIsoLocal(2).split("T")[1]}` 
      : getNowPlusHoursIsoLocal(2);

    setFormData(prev => ({
      ...prev,
      start_time: start,
      end_time: end,
      location: locations[0] || prev.location || "Main Sanctuary"
    }));
    setIsCreateModalOpen(true);
  };

  // Sync filter when coordinator restrictions change
  useEffect(() => {
    if (isRestricted && allowedMinistries.length > 0) {
      setFilterMinistry(String(allowedMinistries[0].id));
      setFormData(prev => ({ ...prev, ministry_id: String(allowedMinistries[0].id) }));
    }
  }, [isRestricted, allowedMinistries]);

  useEffect(() => {
    loadAllMasterData();
    loadLocations();
  }, [selectedMinistryId]);

  // Real-time automatic sync via Socket.IO
  useSocketEvent("events:changed", () => loadAllMasterData());
  useSocketEvent("duty:changed", () => loadAllMasterData());
  useSocketEvent("dishwashing:changed", () => loadAllMasterData());
  useSocketEvent("groups:changed", () => loadAllMasterData());
  useSocketEvent("members:changed", () => loadAllMasterData());
  useSocketEvent("ministries:changed", () => loadAllMasterData());
  useSocketEvent("lookups:changed", () => loadLocations());

  const loadLocations = async () => {
    try {
      const res = await api.getLookups({ type: "event_location", active_only: true });
      if (res && res.length > 0) {
        setLocations(res.map(l => l.name));
      }
    } catch (e) {
      console.warn("Failed to load locations", e);
    }
  };

  const loadAllMasterData = async () => {
    try {
      setLoading(true);
      const ministryScope = isRestricted && allowedMinistries.length > 0 ? allowedMinistries[0].id : undefined;

      const [eventsRes, dutyRes, dishRes, groupsRes, bdaysRes] = await Promise.all([
        api.getEvents({ ministry_id: ministryScope }).catch(() => []),
        api.getDutySchedule({ ministry_id: ministryScope, count: 20 }).catch(() => ({ schedule: [] })),
        api.getDishwashingSchedule({ count: 20 }).catch(() => ({ schedule: [] })),
        api.getGroups({ ministry_id: ministryScope }).catch(() => []),
        api.getBirthdays({ ministry_id: ministryScope, timeframe: "all" }).catch(() => ({ celebrants: [] }))
      ]);

      setEvents(eventsRes || []);
      setSaturdayDuties(dutyRes?.schedule || []);
      setDishwashingDuties(dishRes?.schedule || []);
      setBibleStudyGroups(groupsRes || []);
      setBirthdays(bdaysRes?.celebrants || []);
    } catch (err) {
      console.error("Failed to load unified master events:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTimeChange = (newStart: string) => {
    setFormData(prev => {
      let nextEnd = prev.end_time;
      if (!nextEnd || nextEnd <= newStart) {
        try {
          if (newStart.includes("T")) {
            const [dPart, tPart] = newStart.split("T");
            if (dPart && tPart) {
              const [hStr, mStr] = tPart.split(":");
              let h = parseInt(hStr, 10);
              let endH = (h + 2) % 24;
              nextEnd = `${dPart}T${String(endH).padStart(2, "0")}:${mStr || "00"}`;
            }
          }
        } catch {}
      }
      return {
        ...prev,
        start_time: newStart,
        end_time: nextEnd
      };
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEvent({
        ...formData,
        ministry_id: formData.ministry_id ? Number(formData.ministry_id) : null
      });
      setIsCreateModalOpen(false);
      setFormData({
        title: "",
        description: "",
        ministry_id: "",
        start_time: getNowIsoLocal(),
        end_time: getNowPlusHoursIsoLocal(2),
        location: locations[0] || "Main Sanctuary"
      });
      loadAllMasterData();
    } catch (err: any) {
      showAlert("Event Creation Failed", err.message || "Failed to create event", "danger");
    }
  };

  const handleRsvp = async (eventId: number) => {
    try {
      await api.rsvpEvent(eventId);
      loadAllMasterData();
      if (selectedActivity && selectedActivity.type === "church_event" && selectedActivity.raw_data.id === eventId) {
        setSelectedActivity(prev => prev ? { ...prev, rsvp_count: (prev.rsvp_count || 0) + 1 } : null);
      }
    } catch (err: any) {
      showAlert("RSVP Failed", err.message || "RSVP failed", "danger");
    }
  };

  const handleOpenBirthdayModal = (celebrant: BirthdayCelebrant) => {
    setSelectedBirthday(celebrant);
    setGreetingMessage(
      `Happy ${celebrant.turning_age}th Birthday, ${celebrant.first_name}! 🎂 "The Lord bless you and keep you; the Lord make His face shine upon you and be gracious to you!" (Numbers 6:24-25). Wishing you God's richest peace and blessings!`
    );
    setGreetingSuccess(false);
  };

  const handleSendBirthdayGreeting = async () => {
    if (!selectedBirthday) return;
    try {
      setSendingGreeting(true);
      await api.sendBirthdayGreeting(selectedBirthday.id, {
        message: greetingMessage,
        channel: "announcement"
      });
      setGreetingSuccess(true);
      setTimeout(() => {
        setSelectedBirthday(null);
        setGreetingSuccess(false);
      }, 1500);
    } catch (err: any) {
      showAlert("Greeting Failed", err.message || "Failed to send birthday blessing", "danger");
    } finally {
      setSendingGreeting(false);
    }
  };

  // =========================================================================
  // UNIFIED ACTIVITIES AGGREGATOR (Events + Saturday Duty + Dishwashing + Bible Study + Birthdays)
  // =========================================================================
  const allUnifiedActivities = useMemo(() => {
    const list: UnifiedActivity[] = [];

    // 1. Church Events (Supports Multi-Day Spanning Ranges)
    events.forEach(evt => {
      const startDateStr = evt.start_time ? evt.start_time.split("T")[0] : "";
      const endDateStr = evt.end_time ? evt.end_time.split("T")[0] : startDateStr;
      const isMultiDay = Boolean(startDateStr && endDateStr && endDateStr > startDateStr);

      const startTimeFormatted = formatTime12h(evt.start_time);
      const endTimeFormatted = formatTime12h(evt.end_time);

      let timeFormatted = "";
      if (isMultiDay) {
        timeFormatted = `${startTimeFormatted || "Start"} to ${endTimeFormatted || "End"}`;
      } else {
        timeFormatted = (startTimeFormatted && endTimeFormatted)
          ? `${startTimeFormatted} - ${endTimeFormatted}`
          : (startTimeFormatted || endTimeFormatted || "Scheduled");
      }

      list.push({
        id: `event-${evt.id}`,
        type: "church_event",
        title: evt.title,
        date_str: startDateStr,
        end_date_str: endDateStr,
        is_multiday: isMultiDay,
        start_time_iso: evt.start_time,
        end_time_iso: evt.end_time,
        time_formatted: timeFormatted,
        location: evt.location || "Main Sanctuary",
        ministry_id: evt.ministry_id,
        ministry_name: evt.ministry_name || "All-Church",
        ministry_color: evt.ministry_color || "#2C3968",
        badge_color: evt.ministry_color || "#2C3968",
        description: evt.description,
        rsvp_count: evt.rsvp_count || 0,
        raw_data: evt
      });
    });

    // 2. Saturday Duty Roster
    saturdayDuties.forEach(duty => {
      if (!duty.team) return;
      const dateStr = duty.duty_date ? duty.duty_date.split("T")[0] : "";

      list.push({
        id: `satduty-${dateStr}-${duty.team.id}`,
        type: "saturday_duty",
        title: `Saturday Duty: ${duty.team.name}`,
        date_str: dateStr,
        time_formatted: "8:00 AM - 11:00 AM",
        location: "Church Sanctuary & Grounds",
        ministry_id: duty.team.ministry_id || null,
        ministry_name: duty.team.name,
        ministry_color: duty.team.color || "#2C3968",
        leader_name: duty.team.leader_name || "Assigned Team Leader",
        leader_phone: duty.team.leader_phone || "",
        badge_color: duty.team.color || "#2C3968",
        description: duty.notes || duty.team.tasks_checklist || "Sanctuary cleaning, audio check, restrooms sanitization, trash disposal",
        status: duty.status,
        members_count: duty.team.members?.length || duty.team.members_count || 0,
        checklist: duty.team.tasks_checklist || "Sanctuary cleaning, trash disposal, restroom sanitization",
        raw_data: duty
      });
    });

    // 3. Sunday Dishwashing Duty
    dishwashingDuties.forEach(dish => {
      if (!dish.team) return;
      const dateStr = dish.duty_date ? dish.duty_date.split("T")[0] : "";

      list.push({
        id: `dishwashing-${dateStr}-${dish.team.id}`,
        type: "dishwashing",
        title: `Dishwashing: ${dish.team.name}`,
        date_str: dateStr,
        time_formatted: "12:00 PM - 2:00 PM",
        location: "Fellowship Hall & Kitchen",
        ministry_id: dish.team.ministry_id || null,
        ministry_name: dish.team.cycle_mode === "biblestudy_group" ? "Bible Study Group" : (dish.team.cycle_mode === "ministry" ? "Ministry Unit" : "Kitchen Crew"),
        ministry_color: dish.team.color || "#0D9488",
        leader_name: dish.team.leader_name || "Point Person",
        leader_phone: dish.team.leader_contact || dish.team.leader_phone || "",
        badge_color: dish.team.color || "#0D9488",
        description: dish.notes || dish.team.tasks_checklist || "Post-service fellowship dinnerware washing, sanitization, drying rack storage, counter wipe-down",
        status: dish.status,
        members_count: dish.team.members?.length || dish.team.members_count || dish.team.volunteers_count || 5,
        checklist: dish.team.tasks_checklist || "Plates pre-rinse, 3-compartment wash & sanitize, drying rack storage, kitchen wipedown",
        raw_data: dish
      });
    });

    // 4. Bible Study Small Group Sessions (Mapped onto calendar dates)
    const dayNameToWeekday: Record<string, number> = {
      "Sunday": 0, "Sun": 0,
      "Monday": 1, "Mon": 1,
      "Tuesday": 2, "Tue": 2,
      "Wednesday": 3, "Wed": 3,
      "Thursday": 4, "Thu": 4,
      "Friday": 5, "Fri": 5,
      "Saturday": 6, "Sat": 6
    };

    // Generate weekly recurring instances for Bible Study groups within display range (e.g. Aug - Oct 2026)
    bibleStudyGroups.forEach(group => {
      const weekday = dayNameToWeekday[group.meeting_day];
      if (weekday === undefined) return;

      // Generate dates for August, September, October 2026 (or matching month)
      const startDate = new Date(2026, 6, 1); // July 1, 2026
      const endDate = new Date(2026, 10, 30);  // Nov 30, 2026

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === weekday) {
          const dateStr = d.toISOString().split("T")[0];

          list.push({
            id: `bs-${group.id}-${dateStr}`,
            type: "bible_study",
            title: `Bible Study: ${group.name}`,
            date_str: dateStr,
            time_formatted: group.meeting_time || "7:00 PM",
            location: group.location || "Fellowship Room",
            ministry_id: group.ministry_id,
            ministry_name: group.ministry_name || "Discipleship",
            ministry_color: group.ministry_color || "#7C3AED",
            leader_name: group.leader_name || "Group Leader",
            leader_phone: group.leader_contact || "",
            badge_color: group.ministry_color || "#7C3AED",
            description: `Curriculum: ${group.curriculum || "General Scripture Study"} ${group.current_chapter ? `• Chapter ${group.current_chapter}` : ""}. Meeting in ${group.location || "Fellowship Room"}.`,
            members_count: group.current_member_count || group.members?.length || 0,
            raw_data: group
          });
        }
      }
    });

    // 5. Member Birthdays
    birthdays.forEach(b => {
      // Map for 2026
      const mm = String(b.birth_month).padStart(2, "0");
      const dd = String(b.birth_day).padStart(2, "0");
      const dateStr = `2026-${mm}-${dd}`;

      list.push({
        id: `birthday-${b.id}-${dateStr}`,
        type: "birthday",
        title: `🎂 Birthday: ${b.first_name} ${b.last_name}`,
        date_str: dateStr,
        time_formatted: "All Day",
        location: "Church Fellowship",
        ministry_id: b.ministry_id,
        ministry_name: b.ministry_name || "Celebrant",
        ministry_color: "#EA580C",
        leader_name: `${b.first_name} ${b.last_name}`,
        badge_color: "#EA580C",
        description: `Pastoral milestone: ${b.first_name} ${b.last_name} turns ${b.turning_age} years old on ${b.birth_month}/${b.birth_day}.`,
        raw_data: b
      });
    });

    return list;
  }, [events, saturdayDuties, dishwashingDuties, bibleStudyGroups, birthdays]);

  // Filtered Unified Activities
  const filteredActivities = useMemo(() => {
    return allUnifiedActivities.filter(item => {
      // Ministry filter
      if (filterMinistry && item.ministry_id && String(item.ministry_id) !== filterMinistry) {
        return false;
      }

      // Activity Type filter
      if (filterType !== "all" && item.type !== filterType) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchLocation = item.location ? item.location.toLowerCase().includes(q) : false;
        const matchDesc = item.description ? item.description.toLowerCase().includes(q) : false;
        const matchLeader = item.leader_name ? item.leader_name.toLowerCase().includes(q) : false;
        const matchMin = item.ministry_name ? item.ministry_name.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchLocation && !matchDesc && !matchLeader && !matchMin) {
          return false;
        }
      }

      return true;
    });
  }, [allUnifiedActivities, filterMinistry, filterType, searchQuery]);

  // Calendar Math and Grid Generation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const jumpToday = () => setCurrentDate(new Date());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Calendar Grid Weeks & Multi-Day Spanning Builder
  const calendarWeeks = useMemo(() => {
    // 1. Build all 35 or 42 calendar day cells
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    const allDays: {
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      colIndex: number;
      activitiesCount: number;
    }[] = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const count = filteredActivities.filter(a => isActivityOnDate(a, dateStr)).length;

      allDays.push({
        date: d,
        dateStr,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: false,
        colIndex: allDays.length % 7,
        activitiesCount: count
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const isToday = (i === todayDate && month === todayMonth && year === todayYear);
      const count = filteredActivities.filter(a => isActivityOnDate(a, dateStr)).length;

      allDays.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday,
        colIndex: allDays.length % 7,
        activitiesCount: count
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (allDays.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const count = filteredActivities.filter(a => isActivityOnDate(a, dateStr)).length;

      allDays.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
        colIndex: allDays.length % 7,
        activitiesCount: count
      });
    }

    // 2. Chunk into 7-day week rows and calculate horizontal spanning segments & daily activity columns
    const weeks: {
      weekNumber: number;
      days: typeof allDays;
      multiDaySegments: {
        id: string;
        activity: UnifiedActivity;
        startCol: number;
        endCol: number;
        spanLength: number;
        isStartOfEvent: boolean;
        isEndOfEvent: boolean;
      }[];
      dailyActivitiesMap: Record<number, UnifiedActivity[]>; // colIndex (0..6) -> single-day activities
    }[] = [];

    const totalWeeks = Math.ceil(allDays.length / 7);

    for (let w = 0; w < totalWeeks; w++) {
      const weekDays = allDays.slice(w * 7, (w + 1) * 7);
      if (weekDays.length === 0) continue;

      const weekStartStr = weekDays[0].dateStr;
      const weekEndStr = weekDays[weekDays.length - 1].dateStr;

      const multiDaySegments: {
        id: string;
        activity: UnifiedActivity;
        startCol: number;
        endCol: number;
        spanLength: number;
        isStartOfEvent: boolean;
        isEndOfEvent: boolean;
      }[] = [];

      const dailyActivitiesMap: Record<number, UnifiedActivity[]> = {
        0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
      };

      filteredActivities.forEach(act => {
        const isMulti = Boolean(act.is_multiday && act.end_date_str && act.end_date_str > act.date_str);

        if (isMulti) {
          const actStart = act.date_str;
          const actEnd = act.end_date_str!;

          // Check if multi-day activity overlaps with this week row
          if (actStart <= weekEndStr && actEnd >= weekStartStr) {
            let startCol = 1;
            let isStartOfEvent = false;
            if (actStart >= weekStartStr) {
              const idx = weekDays.findIndex(d => d.dateStr === actStart);
              startCol = idx >= 0 ? idx + 1 : 1;
              isStartOfEvent = true;
            }

            let endCol = 7;
            let isEndOfEvent = false;
            if (actEnd <= weekEndStr) {
              const idx = weekDays.findIndex(d => d.dateStr === actEnd);
              endCol = idx >= 0 ? idx + 1 : 7;
              isEndOfEvent = true;
            }

            const spanLength = Math.max(1, endCol - startCol + 1);

            multiDaySegments.push({
              id: `${act.id}-wk${w}`,
              activity: act,
              startCol,
              endCol,
              spanLength,
              isStartOfEvent,
              isEndOfEvent
            });
          }
        } else {
          // Single-day activity: place exactly in matching day column
          const colIdx = weekDays.findIndex(d => d.dateStr === act.date_str);
          if (colIdx >= 0) {
            dailyActivitiesMap[colIdx].push(act);
          }
        }
      });

      // Sort multi-day segments by length descending
      multiDaySegments.sort((a, b) => {
        if (b.spanLength !== a.spanLength) return b.spanLength - a.spanLength;
        if (a.startCol !== b.startCol) return a.startCol - b.startCol;
        return a.activity.title.localeCompare(b.activity.title);
      });

      weeks.push({
        weekNumber: w,
        days: weekDays,
        multiDaySegments,
        dailyActivitiesMap
      });
    }

    return weeks;
  }, [year, month, filteredActivities]);

  // Chronological upcoming activities list (sorted by date)
  const upcomingActivitiesList = useMemo(() => {
    return [...filteredActivities].sort((a, b) => {
      const dateDiff = new Date(a.date_str).getTime() - new Date(b.date_str).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.title.localeCompare(b.title);
    });
  }, [filteredActivities]);

  // Set default active activity in inspector
  const activeInspectorItem = selectedActivity || upcomingActivitiesList[0] || null;
  const canCreate = user?.role_name === "Admin" || user?.role_name === "Coordinator";

  // Activity Type Counts
  const counts = useMemo(() => {
    return {
      all: allUnifiedActivities.length,
      church_event: allUnifiedActivities.filter(a => a.type === "church_event").length,
      saturday_duty: allUnifiedActivities.filter(a => a.type === "saturday_duty").length,
      dishwashing: allUnifiedActivities.filter(a => a.type === "dishwashing").length,
      bible_study: allUnifiedActivities.filter(a => a.type === "bible_study").length,
      birthday: allUnifiedActivities.filter(a => a.type === "birthday").length,
    };
  }, [allUnifiedActivities]);

  if (loading && allUnifiedActivities.length === 0) {
    return <EventsPageSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ========================================================================= */}
      {/* 1. PAGE HERO HEADER */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Glow ambient spots */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md text-amber-300 ring-1 ring-white/20 shadow-inner">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Master Calendar & Schedule
            </h1>
            <span className="bg-amber-400/20 text-amber-300 border border-amber-300/30 text-xs font-black px-3 py-1 rounded-full shadow-inner flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              {filteredActivities.length} Scheduled
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Unified church operations: Ministry Events, Saturday Cleanliness Duties, Sunday Dishwashing Rotations, Bible Study Groups, and Pastoral Birthdays.
          </p>
        </div>

        {/* Top Actions & View Mode Switcher */}
        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/15 shadow-inner">
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === "calendar" 
                  ? "bg-amber-400 text-slate-950 shadow-md scale-100" 
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === "agenda" 
                  ? "bg-amber-400 text-slate-950 shadow-md scale-100" 
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Agenda Timeline</span>
            </button>
          </div>

          {canCreate && (
            <button
              onClick={() => handleOpenCreateModal()}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:brightness-105 text-slate-950 font-black px-5 py-2.5 rounded-2xl text-xs shadow-lg hover:shadow-amber-400/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Schedule Event</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FILTER CONTROLS BAR: CATEGORY PILLS + SCOPE + SEARCH */}
      {/* ========================================================================= */}
      <div className="bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3.5">
        {/* Row 1: Activity Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterType === "all"
                ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>All Activities ({counts.all})</span>
          </button>

          <button
            onClick={() => setFilterType("church_event")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterType === "church_event"
                ? "bg-indigo-900 text-white shadow-md ring-2 ring-indigo-900/20"
                : "bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-100"
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Church Events ({counts.church_event})</span>
          </button>

          <button
            onClick={() => setFilterType("saturday_duty")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterType === "saturday_duty"
                ? "bg-amber-600 text-white shadow-md ring-2 ring-amber-600/20"
                : "bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/80"
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Saturday Duty ({counts.saturday_duty})</span>
          </button>

          <button
            onClick={() => setFilterType("dishwashing")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterType === "dishwashing"
                ? "bg-teal-700 text-white shadow-md ring-2 ring-teal-700/20"
                : "bg-teal-50 text-teal-900 hover:bg-teal-100 border border-teal-200/80"
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Sunday Dishwashing ({counts.dishwashing})</span>
          </button>

          <button
            onClick={() => setFilterType("bible_study")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterType === "bible_study"
                ? "bg-purple-700 text-white shadow-md ring-2 ring-purple-700/20"
                : "bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200/80"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Bible Study Groups ({counts.bible_study})</span>
          </button>

          <button
            onClick={() => setFilterType("birthday")}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterType === "birthday"
                ? "bg-rose-600 text-white shadow-md ring-2 ring-rose-600/20"
                : "bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-200/80"
            }`}
          >
            <Cake className="w-3.5 h-3.5" />
            <span>Birthdays ({counts.birthday})</span>
          </button>
        </div>

        {/* Row 2: Ministry Scope + Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Layers className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-bold text-slate-600">Ministry Scope:</span>
            <select
              value={filterMinistry}
              onChange={(e) => setFilterMinistry(e.target.value)}
              disabled={isRestricted && allowedMinistries.length <= 1}
              className="bg-slate-50 px-3.5 py-1.5 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 cursor-pointer disabled:opacity-90 disabled:cursor-not-allowed"
            >
              {!isRestricted && <option value="">All Church Ministries</option>}
              {allowedMinistries.map((m) => (
                <option key={m.id} value={m.id}>{m.name} Ministry</option>
              ))}
            </select>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, team, leader, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 pl-9 pr-8 py-1.5 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN 2-COLUMN LAYOUT: CALENDAR/AGENDA (LEFT) + ACTIVITY INSPECTOR (RIGHT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: CALENDAR OR AGENDA VIEW */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {viewMode === "calendar" ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
              {/* Calendar Month Navigation Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-white/10 text-amber-300 shadow-inner">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                      <span>{monthNames[month]} {year}</span>
                    </h2>
                    <p className="text-[11px] text-slate-300">Click any activity badge to inspect complete details on the right</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={jumpToday}
                    className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition-all cursor-pointer shadow-2xs"
                  >
                    Today
                  </button>
                  <div className="flex items-center bg-white/10 rounded-xl p-0.5 border border-white/20">
                    <button
                      onClick={prevMonth}
                      className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={nextMonth}
                      className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Weekday Column Headers */}
              <div className="grid grid-cols-7 bg-slate-50/80 border-b border-slate-200 text-center py-2.5 text-xs font-black uppercase text-[10px] tracking-wider text-slate-500">
                <span className="text-rose-600 font-black">Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span className="text-slate-800 font-black">Sat</span>
              </div>

              {/* 35/42 Days Grid Cells Organized into Clean 2-Tier Weekly Rows */}
              <div className="divide-y divide-slate-100">
                {calendarWeeks.map((week) => (
                  <div key={week.weekNumber} className="relative min-h-[120px] sm:min-h-[140px] flex flex-col justify-start">
                    {/* Background Day Cell Columns Grid */}
                    <div className="absolute inset-0 grid grid-cols-7 divide-x divide-slate-100 pointer-events-none">
                      {week.days.map((day, dIdx) => (
                        <div
                          key={dIdx}
                          className={`h-full transition-colors ${
                            day.isToday 
                              ? "bg-amber-50/30" 
                              : day.isCurrentMonth 
                              ? "bg-white" 
                              : "bg-slate-50/60"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Day Numbers Row */}
                    <div className="relative z-10 grid grid-cols-7 px-1 pt-1 text-left pointer-events-auto">
                      {week.days.map((day, dIdx) => (
                        <div key={dIdx} className="p-1 flex items-center justify-between">
                          <button
                            onClick={(e) => {
                              const allDayActs = filteredActivities.filter(a => isActivityOnDate(a, day.dateStr));
                              if (allDayActs.length > 0) {
                                handleOpenDayPopover(e, day.dateStr);
                              } else if (canCreate) {
                                handleOpenCreateModal(day.dateStr);
                              }
                            }}
                            className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full transition-all cursor-pointer ${
                              day.isToday
                                ? "bg-amber-400 text-slate-950 font-black shadow-md ring-2 ring-amber-300"
                                : day.isCurrentMonth
                                ? "text-slate-800 hover:bg-slate-200"
                                : "text-slate-400 hover:bg-slate-200"
                            }`}
                            title={day.activitiesCount > 0 ? `View ${day.activitiesCount} activities on this day` : "Schedule event on this day"}
                          >
                            {day.dayNumber}
                          </button>
                          {day.activitiesCount > 0 && (
                            <button
                              onClick={(e) => handleOpenDayPopover(e, day.dateStr)}
                              className="text-[9px] font-black text-slate-600 hover:text-indigo-950 bg-slate-100 hover:bg-indigo-100 border border-slate-200/70 px-1.5 py-0.5 rounded-full cursor-pointer transition-colors shadow-2xs"
                              title="Click to view all activities on this date"
                            >
                              {day.activitiesCount}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* TIER 1: SPANNING MULTI-DAY BARS (Max 2 Spanning Bars Per Week Row) */}
                    {week.multiDaySegments.length > 0 && (
                      <div className="relative z-10 grid grid-cols-7 gap-y-1 px-1.5 py-1 pointer-events-auto">
                        {week.multiDaySegments.slice(0, 2).map((segment) => {
                          const isSelected = activeInspectorItem?.id === segment.activity.id;

                          return (
                            <div
                              key={segment.id}
                              onClick={() => setSelectedActivity(segment.activity)}
                              style={{
                                gridColumnStart: segment.startCol,
                                gridColumnEnd: segment.endCol + 1,
                                backgroundColor: segment.activity.badge_color
                              }}
                              className={`h-[26px] text-white text-[11px] font-extrabold px-3 flex items-center justify-between shadow-2xs transition-all hover:brightness-110 cursor-pointer truncate ${
                                segment.isStartOfEvent ? "rounded-l-xl" : "rounded-l-none pl-2 border-l-2 border-dashed border-white/40"
                              } ${
                                segment.isEndOfEvent ? "rounded-r-xl" : "rounded-r-none pr-2 border-r-2 border-dashed border-white/40"
                              } ${isSelected ? "ring-2 ring-amber-400 ring-offset-1 z-20 shadow-md" : ""}`}
                              title={`${segment.activity.title} (${segment.activity.time_formatted})`}
                            >
                              <div className="flex items-center gap-1.5 truncate min-w-0">
                                {segment.isStartOfEvent && <CalendarIcon className="w-3.5 h-3.5 shrink-0 text-amber-300" />}
                                {!segment.isStartOfEvent && <span className="text-[10px] opacity-75 font-mono">↳</span>}
                                <span className="truncate">{segment.activity.title}</span>
                              </div>

                              <span className="text-[8px] font-black bg-black/30 px-2 py-0.5 rounded-md text-white/95 shrink-0 ml-2 uppercase tracking-tighter">
                                {segment.isStartOfEvent && segment.isEndOfEvent
                                  ? `${segment.spanLength} Days Range`
                                  : (segment.isStartOfEvent ? "Starts" : (segment.isEndOfEvent ? "Ends" : "Ongoing"))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* TIER 2: DEDICATED 7-COLUMN SLOTS FOR SINGLE-DAY ACTIVITIES */}
                    <div className="relative z-10 grid grid-cols-7 gap-1 p-1.5 flex-1 pointer-events-auto">
                      {week.days.map((day, dIdx) => {
                        const dayActivities = week.dailyActivitiesMap[dIdx] || [];
                        const visibleMultiCount = week.multiDaySegments.slice(0, 2).filter(
                          seg => (dIdx + 1) >= seg.startCol && (dIdx + 1) <= seg.endCol
                        ).length;
                        const maxSingleToShow = Math.max(0, 2 - visibleMultiCount);
                        const visibleSingle = dayActivities.slice(0, maxSingleToShow);
                        const totalVisibleOnDay = visibleMultiCount + visibleSingle.length;
                        const hiddenCountOnDay = day.activitiesCount - totalVisibleOnDay;

                        return (
                          <div key={dIdx} className="space-y-1 min-w-0 flex flex-col justify-start">
                            {visibleSingle.map((act) => {
                              const isSelected = activeInspectorItem?.id === act.id;

                              return (
                                <div
                                  key={act.id}
                                  onClick={() => setSelectedActivity(act)}
                                  style={{ backgroundColor: act.badge_color }}
                                  className={`rounded-lg px-2 py-1 text-white text-[10px] font-extrabold shadow-2xs transition-all hover:brightness-110 cursor-pointer flex items-center gap-1 truncate ${
                                    isSelected ? "ring-2 ring-amber-400 ring-offset-1 z-20 shadow-md" : ""
                                  }`}
                                  title={`${act.title} (${act.time_formatted})`}
                                >
                                  {act.type === "church_event" && <CalendarIcon className="w-3 h-3 shrink-0" />}
                                  {act.type === "saturday_duty" && <CalendarCheck className="w-3 h-3 shrink-0 text-amber-300" />}
                                  {act.type === "dishwashing" && <Utensils className="w-3 h-3 shrink-0 text-teal-200" />}
                                  {act.type === "bible_study" && <BookOpen className="w-3 h-3 shrink-0 text-purple-200" />}
                                  {act.type === "birthday" && <Cake className="w-3 h-3 shrink-0 text-rose-200" />}
                                  <span className="truncate">{act.title.replace("Saturday Duty: ", "").replace("Dishwashing: ", "").replace("Bible Study: ", "").replace("🎂 Birthday: ", "")}</span>
                                </div>
                              );
                            })}

                            {hiddenCountOnDay > 0 && (
                              <button
                                onClick={(e) => handleOpenDayPopover(e, day.dateStr)}
                                className="w-full text-[9px] font-black text-indigo-700 hover:text-indigo-950 bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200/70 py-0.5 px-1 rounded-md text-center cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-0.5"
                                title={`Click to view all ${day.activitiesCount} events on this date`}
                              >
                                +{hiddenCountOnDay} more
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* AGENDA / TIMELINE LIST VIEW */
            <div className="space-y-3.5">
              {upcomingActivitiesList.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-xs text-slate-400 space-y-2">
                  <CalendarIcon className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="font-bold text-slate-600">No activities found matching your filters.</p>
                  <p className="text-[11px]">Try selecting "All Activities" or clearing your search query.</p>
                </div>
              ) : (
                upcomingActivitiesList.map((act) => {
                  const isSelected = activeInspectorItem?.id === act.id;
                  const dateObj = new Date(act.date_str);
                  const monthName = dateObj.toLocaleString([], { month: "short" });
                  const dayNum = dateObj.getDate();
                  const isMulti = Boolean(act.is_multiday && act.end_date_str && act.end_date_str > act.date_str);

                  return (
                    <div
                      key={act.id}
                      onClick={() => setSelectedActivity(act)}
                      className={`bg-white rounded-3xl p-4 sm:p-5 border shadow-2xs hover:border-indigo-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer ${
                        isSelected ? "border-indigo-400 ring-2 ring-indigo-200/60 bg-indigo-50/20" : "border-slate-200/90"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Date Mini Box */}
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col justify-center items-center shrink-0 p-1">
                          {isMulti && act.end_date_str ? (
                            <>
                              <span className="text-[8px] font-black uppercase text-rose-600 leading-none">
                                {monthName}
                              </span>
                              <span className="text-xs font-black text-slate-900 leading-tight mt-0.5">
                                {act.date_str.split("-")[2]} → {act.end_date_str.split("-")[2]}
                              </span>
                              <span className="text-[7px] font-bold text-slate-400 uppercase">Multi-Day</span>
                            </>
                          ) : (
                            <>
                              <span className="text-[9px] font-black uppercase text-rose-600 leading-none">{monthName}</span>
                              <span className="text-lg font-black text-slate-900 leading-tight">{dayNum}</span>
                            </>
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[9px] font-black px-2 py-0.5 rounded-md text-white uppercase tracking-wide"
                              style={{ backgroundColor: act.badge_color }}
                            >
                              {act.type.replace("_", " ")}
                            </span>
                            {isMulti && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wide">
                                Multi-Day Range
                              </span>
                            )}
                            <h3 className="text-sm font-black text-slate-900 truncate">{act.title}</h3>
                          </div>

                          <p className="text-xs text-slate-500 line-clamp-1">{act.description}</p>

                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap pt-0.5">
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              {act.time_formatted}
                            </span>
                            {act.location && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 font-medium">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                  {act.location}
                                </span>
                              </>
                            )}
                            {act.leader_name && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 font-medium">
                                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                                  Lead: {act.leader_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action Pill */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        {act.type === "church_event" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRsvp(act.raw_data.id);
                            }}
                            className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>RSVP ({act.rsvp_count || 0})</span>
                          </button>
                        )}
                        {act.type === "birthday" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBirthdayModal(act.raw_data);
                            }}
                            className="bg-rose-500 hover:bg-rose-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            <span>Send Blessing</span>
                          </button>
                        )}
                        <span className="p-1.5 rounded-xl bg-slate-100 text-slate-400 group-hover:text-slate-700">
                          <ChevronRightIcon className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: UNIFIED ACTIVITY INSPECTOR & DETAILS PANEL */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* INSPECTOR CONTAINER */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 text-amber-300 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Activity Inspector</h3>
                  <p className="text-[11px] text-slate-400">Detailed schedule, roster & actions</p>
                </div>
              </div>
              {activeInspectorItem && (
                <span
                  className="text-[10px] font-black px-2.5 py-0.5 rounded-full text-white uppercase shadow-2xs"
                  style={{ backgroundColor: activeInspectorItem.badge_color }}
                >
                  {activeInspectorItem.type.replace("_", " ")}
                </span>
              )}
            </div>

            {activeInspectorItem ? (
              <div className="space-y-4 text-xs">
                {/* Title & Classification */}
                <div>
                  <h4 className="text-base font-black text-slate-900 leading-snug">
                    {activeInspectorItem.title}
                  </h4>
                  <p className="text-slate-600 mt-1.5 leading-relaxed">
                    {activeInspectorItem.description || "No specific remarks registered."}
                  </p>
                </div>

                {/* Time & Location Box */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                  {activeInspectorItem.is_multiday && activeInspectorItem.end_date_str ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-slate-900 text-xs flex-wrap">
                        <CalendarIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>
                          {formatDateDisplay(activeInspectorItem.date_str)} – {formatDateDisplay(activeInspectorItem.end_date_str)}
                        </span>
                        <span className="text-[9px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-md uppercase tracking-wider ml-auto">
                          Multi-Day Range
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 font-semibold text-[11px] pl-6">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          {formatTime12h(activeInspectorItem.start_time_iso)} (Start) to {formatTime12h(activeInspectorItem.end_time_iso)} (End)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-slate-900 text-xs">
                        <CalendarIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{formatDateDisplay(activeInspectorItem.date_str)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 font-semibold text-[11px] pl-6">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{activeInspectorItem.time_formatted}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200/70 space-y-2">
                    {activeInspectorItem.location && (
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Location: <strong className="text-slate-900 font-bold">{activeInspectorItem.location}</strong></span>
                      </div>
                    )}

                    {activeInspectorItem.ministry_name && (
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Tag className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Ministry / Unit: <strong className="text-slate-900 font-bold">{activeInspectorItem.ministry_name}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Specific Details based on Type */}
                {/* 1. Saturday Duty / Dishwashing Leader Info */}
                {(activeInspectorItem.type === "saturday_duty" || activeInspectorItem.type === "dishwashing" || activeInspectorItem.type === "bible_study") && activeInspectorItem.leader_name && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Point Person / Leader</span>
                        <span className="font-black text-slate-900">{activeInspectorItem.leader_name}</span>
                      </div>
                    </div>
                    {activeInspectorItem.leader_phone && (
                      <a 
                        href={`tel:${activeInspectorItem.leader_phone}`}
                        className="text-[11px] text-indigo-900 font-mono font-bold bg-indigo-100/70 hover:bg-indigo-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{activeInspectorItem.leader_phone}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* 2. Tasks / Checklist Preview */}
                {activeInspectorItem.checklist && (
                  <div className="p-3.5 rounded-2xl bg-teal-50/40 border border-teal-100">
                    <span className="text-[10px] font-black uppercase text-teal-900 block mb-1">Responsibilities / Checklist</span>
                    <p className="text-[11px] text-teal-950/80 leading-relaxed font-medium">
                      {activeInspectorItem.checklist}
                    </p>
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {activeInspectorItem.type === "church_event" && (
                    <button
                      onClick={() => handleRsvp(activeInspectorItem.raw_data.id)}
                      className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-105 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>RSVP Going ({activeInspectorItem.rsvp_count || 0})</span>
                    </button>
                  )}

                  {activeInspectorItem.type === "birthday" && (
                    <button
                      onClick={() => handleOpenBirthdayModal(activeInspectorItem.raw_data)}
                      className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <Gift className="w-4 h-4" />
                      <span>Send Birthday Blessing</span>
                    </button>
                  )}

                  {activeInspectorItem.type === "saturday_duty" && (
                    <div className="text-slate-500 text-[11px] flex items-center gap-1.5 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200 w-full justify-center">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Saturday Cleaning: <strong>{activeInspectorItem.members_count || 0}</strong> disciples assigned</span>
                    </div>
                  )}

                  {activeInspectorItem.type === "dishwashing" && (
                    <div className="text-slate-500 text-[11px] flex items-center gap-1.5 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200 w-full justify-center">
                      <Droplets className="w-4 h-4 text-teal-600" />
                      <span>Kitchen Roster: <strong>{activeInspectorItem.members_count || 5}</strong> volunteers active</span>
                    </div>
                  )}

                  {activeInspectorItem.type === "bible_study" && (
                    <div className="text-slate-500 text-[11px] flex items-center gap-1.5 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200 w-full justify-center">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      <span>Discipleship Group: <strong>{activeInspectorItem.members_count || 0}</strong> disciples enrolled</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <CalendarIcon className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-bold text-slate-600">No activity selected</p>
                <p className="text-[11px]">Click any event badge on the calendar to view its details here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE EVENT MODAL */}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                <span>Schedule New Ministry Event</span>
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Youth Encounter Night, Fellowship Lunch"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Host Ministry</label>
                <select
                  value={formData.ministry_id}
                  onChange={(e) => setFormData({ ...formData, ministry_id: e.target.value })}
                  disabled={isRestricted && allowedMinistries.length <= 1}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 font-medium"
                >
                  <option value="">All-Church Event</option>
                  {allowedMinistries.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} Ministry</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <DateTimePickerInput
                    label="Start Date & Time *"
                    value={formData.start_time}
                    onChange={handleStartTimeChange}
                    required
                  />
                </div>
                <div>
                  <DateTimePickerInput
                    label="End Date & Time *"
                    value={formData.end_time}
                    onChange={(val) => setFormData(prev => ({ ...prev, end_time: val }))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Location / Venue *</label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 font-medium"
                >
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                  <option value="Main Sanctuary">Main Sanctuary</option>
                  <option value="Fellowship Hall">Fellowship Hall</option>
                  <option value="Youth Room">Youth Room</option>
                  <option value="Outreach Site">Outreach Site</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description & Details</label>
                <textarea
                  rows={3}
                  placeholder="Provide instructions, speaker details, or reminders..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 font-medium"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md cursor-pointer"
                >
                  Publish Event
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* SEND BIRTHDAY BLESSING MODAL */}
      {selectedBirthday && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cake className="w-5 h-5 text-rose-500" />
                <span>Send Birthday Blessing to {selectedBirthday.first_name}</span>
              </h2>
              <button onClick={() => setSelectedBirthday(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 text-slate-800">
                <span className="font-bold block text-rose-950">Pastoral Care Milestone</span>
                <span>{selectedBirthday.first_name} {selectedBirthday.last_name} ({selectedBirthday.ministry_name || "General Member"}) turning {selectedBirthday.turning_age} years old on {selectedBirthday.birth_month}/{selectedBirthday.birth_day}.</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pastoral Blessing Message</label>
                <textarea
                  rows={4}
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 font-medium"
                ></textarea>
              </div>

              {greetingSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-900 font-bold rounded-xl border border-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Blessing broadcasted to church wall!</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBirthday(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={sendingGreeting || greetingSuccess}
                  onClick={handleSendBirthdayGreeting}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingGreeting ? "Sending..." : "Post Blessing"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* FLOATING GOOGLE-CALENDAR STYLE DAY POPOVER */}
      {dayPopover && createPortal(
        <div 
          className="fixed inset-0 z-[120]"
          onClick={() => setDayPopover(null)}
        >
          {/* Popover Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              top: Math.min(Math.max(16, dayPopover.y - 10), window.innerHeight - 340),
              left: Math.min(Math.max(16, dayPopover.x - 140), window.innerWidth - 300)
            }}
            className="fixed w-72 bg-white rounded-2xl p-3.5 shadow-2xl border border-slate-200/90 space-y-2.5 z-[121] animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-1 px-1">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                {formatDateDisplay(dayPopover.dateStr)}
              </h3>
              <button
                onClick={() => setDayPopover(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Activities Capsule List */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5 no-scrollbar">
              {dayPopover.activities.map((act) => {
                const isSelected = activeInspectorItem?.id === act.id;
                const isMulti = Boolean(act.is_multiday && act.end_date_str && act.end_date_str > act.date_str);

                return (
                  <div
                    key={act.id}
                    onClick={() => {
                      setSelectedActivity(act);
                      setDayPopover(null);
                    }}
                    style={{
                      backgroundColor: `${act.badge_color}14`,
                      borderColor: `${act.badge_color}35`
                    }}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 hover:brightness-95 hover:scale-[1.01] shadow-2xs ${
                      isSelected ? "ring-2 ring-amber-400 ring-offset-1 font-black" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: act.badge_color }}
                      />
                      {act.type === "church_event" && <CalendarIcon className="w-3.5 h-3.5 shrink-0 text-indigo-700" />}
                      {act.type === "saturday_duty" && <CalendarCheck className="w-3.5 h-3.5 shrink-0 text-amber-600" />}
                      {act.type === "dishwashing" && <Utensils className="w-3.5 h-3.5 shrink-0 text-teal-700" />}
                      {act.type === "bible_study" && <BookOpen className="w-3.5 h-3.5 shrink-0 text-purple-700" />}
                      {act.type === "birthday" && <Cake className="w-3.5 h-3.5 shrink-0 text-rose-600" />}

                      <span className="text-xs font-bold text-slate-900 truncate">
                        {act.title.replace("Saturday Duty: ", "").replace("Dishwashing: ", "").replace("Bible Study: ", "").replace("🎂 Birthday: ", "")}
                      </span>
                    </div>

                    {isMulti ? (
                      <span className="text-[8px] font-black uppercase bg-amber-200/60 text-amber-950 px-1.5 py-0.5 rounded shrink-0">
                        Multi-Day
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-slate-500 shrink-0">
                        {act.time_formatted.split(" - ")[0]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {canCreate && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    const d = dayPopover.dateStr;
                    setDayPopover(null);
                    handleOpenCreateModal(d);
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-600" />
                  <span>Add Event on this Day</span>
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Reusable Confirmation & Alert Modal */}
      <ConfirmationModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        description={confirmModalConfig.description}
        type={confirmModalConfig.type}
        confirmText={confirmModalConfig.confirmText}
        cancelText={confirmModalConfig.cancelText}
        isLoading={confirmModalConfig.isLoading}
        onConfirm={confirmModalConfig.onConfirm}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};


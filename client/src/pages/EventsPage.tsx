import { EventMinistryPicker } from "../components/events/EventMinistryPicker";
import { EventInvitationsModal } from "../components/events/EventInvitationsModal";
import { FilterPanel } from "../components/common/FilterPanel";
import { Pagination } from "../components/common/Pagination";
import { useListPagination } from "../hooks/useListPagination";
import { PageHeader } from "../components/common/PageHeader";
import { ModalPanel } from "../components/common/ModalPanel";
import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { 
  EventItem, BirthdayCelebrant, SaturdayDutyScheduleItem, 
  SundayDutyScheduleItem, BibleStudyGroup, Ministry 
} from "../types";
import {
  Calendar as CalendarIcon, Plus, MapPin, Clock, Users,
  CheckCircle2, ChevronLeft, ChevronRight, Filter, Search,
  Layers, LayoutGrid, List, X, AlertCircle,
  Cake, Gift, PartyPopper, Send, Check, Utensils, CalendarCheck,
  BookOpen, ShieldCheck, Droplets, ChevronRight as ChevronRightIcon,
  Phone, ExternalLink, Tag, ChevronDown, ChevronUp, Sun, UserCheck
} from "lucide-react";
import { DateTimePickerInput } from "../components/common/DateTimePickerInput";
import { useSocketEvent } from "../socket";
import { EventsPageSkeleton } from "../components/common/SkeletonLoader";
import { ConfirmationModal, ModalType } from "../components/common/ConfirmationModal";
import { EventAttendanceModal } from "../components/common/EventAttendanceModal";
import "./EventsPage.css";
import { Dialog } from "../components/common/Dialog";
import { Button } from "../components/common/Button";
import { calendarScheduleKey, groupCalendarSegments } from "../utils/calendarScheduleGroups";
import { formatDateToYMD } from "../utils/scheduleHelper";

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
  ministry_ids?: number[];
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

export interface EventsPageProps {
  onNavigate?: (tab: any) => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({ onNavigate }) => {
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
  const [invitationEvent, setInvitationEvent] = useState<EventItem | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<UnifiedActivity | null>(null);
  const [selectedScheduleKey, setSelectedScheduleKey] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [attendanceModalEvent, setAttendanceModalEvent] = useState<EventItem | null>(null);
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
    ministry_ids: (isRestricted && allowedMinistries.length > 0 ? [allowedMinistries[0].id] : []) as number[],
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
      setFormData(prev => ({ ...prev, ministry_id: String(allowedMinistries[0].id), ministry_ids: [allowedMinistries[0].id] }));
    }
  }, [isRestricted, allowedMinistries]);

  useEffect(() => {
    loadAllMasterData();
    loadLocations();
  }, [selectedMinistryId, currentDate.getFullYear(), currentDate.getMonth()]);

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
    guideData.clearError();
    try {
      setLoading(true);
      const ministryScope = isRestricted && allowedMinistries.length > 0 ? allowedMinistries[0].id : undefined;

      const [eventsRes, dutyRes, dishRes, groupsRes, bdaysRes] = await Promise.all([
        api.getEvents({ ministry_id: ministryScope, from: new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), -6)).toISOString().slice(0, 10), to: new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth() + 1, 7)).toISOString().slice(0, 10) }).catch(err => { guideData.reportError(err); return []; }),
        api.getDutySchedule({ ministry_id: ministryScope, count: 20 }).catch(() => ({ schedule: [] })),
        api.getDishwashingSchedule({ count: 20 }).catch(() => ({ schedule: [] })),
        api.getGroups({ ministry_id: ministryScope, status: "active", view: "calendar" }).catch(() => []),
        api.getBirthdays({ ministry_id: ministryScope, timeframe: "all", month: currentDate.getMonth() + 1 }).catch(() => ({ celebrants: [] }))
      ]);

      setEvents(eventsRes || []);
      setSaturdayDuties(dutyRes?.schedule || []);
      setDishwashingDuties(dishRes?.schedule || []);
      setBibleStudyGroups(groupsRes || []);
      setBirthdays(bdaysRes?.celebrants || []);
    } catch (err) {
      console.error("Failed to load unified master events:", err);
      guideData.reportError(err);
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
    if (!formData.title.trim()) {
      showAlert("Title Required", "Please enter an event title.", "warning");
      return;
    }

    if (!formData.start_time || !formData.end_time) {
      showAlert("Time Required", "Start and End times are required.", "warning");
      return;
    }

    if (new Date(formData.end_time).getTime() < new Date(formData.start_time).getTime()) {
      showAlert("Invalid Time Range", "Event end time cannot be earlier than start time.", "warning");
      return;
    }

    const dupEvent = events.find(ev =>
      ev.title.toLowerCase().trim() === formData.title.toLowerCase().trim() &&
      ev.start_time?.split("T")[0] === formData.start_time.split("T")[0]
    );

    if (dupEvent) {
      showAlert("Duplicate Event", `An event named "${formData.title}" is already scheduled on this date.`, "warning");
      return;
    }

    try {
      await api.createEvent({
        ...formData,
        title: formData.title.trim(),
        ministry_id: formData.ministry_id ? Number(formData.ministry_id) : null
      });
      setIsCreateModalOpen(false);
      setFormData({
        title: "",
        description: "",
        ministry_ids: [],
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
      `Happy ${celebrant.turning_age}th Birthday, ${celebrant.first_name}!"The Lord bless you and keep you; the Lord make His face shine upon you and be gracious to you!"(Numbers 6:24-25). Wishing you God's richest peace and blessings!`
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
        ministry_ids: evt.ministry_ids,
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

    // Generate recurring sessions for the displayed month, including grid padding days.
    const displayYear = currentDate.getFullYear();
    const displayMonth = currentDate.getMonth();
    const firstDay = new Date(displayYear, displayMonth, 1);
    const startDate = new Date(displayYear, displayMonth, 1 - firstDay.getDay());
    const monthDays = new Date(displayYear, displayMonth + 1, 0).getDate();
    const gridDays = Math.ceil((firstDay.getDay() + monthDays) / 7) * 7;
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + gridDays - 1);
    bibleStudyGroups.forEach(group => {
      const weekday = dayNameToWeekday[group.meeting_day];
      if (weekday === undefined) return;

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === weekday) {
          const dateStr = formatDateToYMD(d);

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
        title: `Birthday: ${b.first_name} ${b.last_name}`,
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
  }, [events, saturdayDuties, dishwashingDuties, bibleStudyGroups, birthdays, currentDate]);

  // Filtered Unified Activities
  const filteredActivities = useMemo(() => {
    return allUnifiedActivities.filter(item => {
      // Ministry filter
      if (filterMinistry && item.ministry_id && !(item.ministry_ids || [item.ministry_id]).includes(Number(filterMinistry))) {
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
  const groupedCalendarWeeks = useMemo(() => calendarWeeks.map(week => groupCalendarSegments(week.multiDaySegments)), [calendarWeeks]);
  const selectedScheduleActivities = selectedScheduleKey ? filteredActivities.filter(activity => activity.is_multiday && calendarScheduleKey(activity) === selectedScheduleKey) : [];
  const upcomingActivitiesList = useMemo(() => {
    return [...filteredActivities].sort((a, b) => {
      const dateDiff = new Date(a.date_str).getTime() - new Date(b.date_str).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.title.localeCompare(b.title);
    });
  }, [filteredActivities]);

  const agendaPage = useListPagination(upcomingActivitiesList, JSON.stringify([filterType, filterMinistry, searchQuery, currentDate.getFullYear(), currentDate.getMonth()]));
  // Set default active activity in inspector
  const activeInspectorItem = (selectedActivity && filteredActivities.find(activity => activity.id === selectedActivity.id))
    || filteredActivities.find(activity => isActivityOnDate(activity, `${year}-${String(month + 1).padStart(2, "0")}-01`)
      || activity.date_str.startsWith(`${year}-${String(month + 1).padStart(2, "0")}-`)) || null;
  const canCreate = user?.role_name === "Admin" || user?.role_name === "Pastor" || user?.role_name === "Coordinator" || user?.role_name === "IT Admin";

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

  const guideData = useGuideDataState("calendar-events", { loading, count: filteredActivities.length, filtered: true, retry: loadAllMasterData });

  if (loading && allUnifiedActivities.length === 0) {
    return <EventsPageSkeleton />;
  }

  return (
    <div className="church-calendar space-y-5 animate-fade-in">
      {/* ========================================================================= */}
      {/* 1. PAGE HERO HEADER */}
      {/* ========================================================================= */}
      <PageHeader icon={<CalendarIcon />} title={<>Church calendar</>}
        description={<>Gatherings, serving schedules, and milestones in one place.</>}
        actions={<><div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
          <div className="calendar-view-switch flex items-center p-1 rounded-xl" aria-label="Calendar view">
            <button data-guide="calendar-view"
              aria-pressed={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${viewMode === "calendar"
                ? "bg-amber-400 text-slate-950 shadow-sm scale-100"
                : "text-muted hover:text-charcoal"
                }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
            <button data-guide="calendar-agenda"
              aria-pressed={viewMode === "agenda"}
              onClick={() => setViewMode("agenda")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${viewMode === "agenda"
                ? "bg-amber-400 text-slate-950 shadow-sm scale-100"
                : "text-muted hover:text-charcoal"
                }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>
          </div>

          {onNavigate && (
            <Button onClick={() => onNavigate("sundaycycle")} variant="secondary">
              <Sun className="w-4 h-4 " />
              <span>Events & Celebrations</span>
            </Button>
          )}

          {canCreate && (
            <Button onClick={() => {
              if (onNavigate) {
                onNavigate("sundaycycle");
              } else {
                handleOpenCreateModal();
              }
            }} variant="secondary">
              <Plus className="w-4 h-4 " />
              <span>Add Event / Celebration</span>
            </Button>
          )}
        </div></>} />

      {/* ========================================================================= */}
      {/* 2. FILTER CONTROLS BAR: CATEGORY PILLS + SCOPE + SEARCH */}
      {/* ========================================================================= */}
      <FilterPanel title="Calendar filters" summary={[filterType === "all" ? "All activities" : filterType.replace(/_/g, " "), searchQuery].filter(Boolean).join(" · ")}>
        <div className="filter-panel-layout calendar-filters p-4 rounded-2xl space-y-3.5">
        {/* Row 1: Activity Category Filters */}
        <div data-guide="calendar-kinds" className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilterType("all")}
            aria-pressed={filterType === "all"}
            className={`px-3.5 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterType === "all"
                ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Activities ({counts.all})</span>
          </button>

          <button
            onClick={() => setFilterType("church_event")}
            aria-pressed={filterType === "church_event"}
            className={`px-3.5 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
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
            aria-pressed={filterType === "saturday_duty"}
            className={`px-3.5 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
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
            aria-pressed={filterType === "dishwashing"}
            className={`px-3.5 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
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
            aria-pressed={filterType === "bible_study"}
            className={`px-3.5 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
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
            aria-pressed={filterType === "birthday"}
            className={`px-3.5 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
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
            <span className="text-xs font-medium text-slate-600">Ministry Scope:</span>
            <select data-guide="calendar-ministry"
              aria-label="Ministry scope"
              value={filterMinistry}
              onChange={(e) => setFilterMinistry(e.target.value)}
              disabled={isRestricted && allowedMinistries.length <= 1}
              className="bg-slate-50 px-3.5 py-1.5 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-800 cursor-pointer disabled:opacity-90 disabled:cursor-not-allowed"
            >
              {!isRestricted && <option value="">All Church Ministries</option>}
              {allowedMinistries.map((m) => (
                <option key={m.id} value={m.id}>{m.name} Ministry</option>
              ))}
            </select>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input data-guide="calendar-search"
              aria-label="Search activities"
              type="text"
              placeholder="Search title, team, leader, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 pl-9 pr-8 py-1.5 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear activity search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      </FilterPanel>

      {/* ========================================================================= */}
      {/* 3. MAIN 2-COLUMN LAYOUT: CALENDAR/AGENDA (LEFT) + ACTIVITY INSPECTOR (RIGHT) */}
      {/* ========================================================================= */}
      <div className="calendar-workspace grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: CALENDAR OR AGENDA VIEW */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {viewMode === "calendar" ? (
            <div className="calendar-surface rounded-2xl overflow-hidden">
              {/* Calendar Month Navigation Header */}
              <div className="calendar-month-header p-4 sm:p-5 flex flex-wrap gap-3 items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                      <span>{monthNames[month]} {year}</span>
                    </h2>
                    <p className="calendar-subtitle text-xs mt-1">Select an activity to view its details</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={jumpToday}
                    className="calendar-secondary-action px-3.5 py-2 text-xs font-medium rounded-lg"
                  >
                    Today
                  </button>
                  <div className="calendar-month-arrows flex items-center rounded-lg p-0.5">
                    <button
                      onClick={prevMonth}
                      className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title="Previous Month"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={nextMonth}
                      className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
                      title="Next Month"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Weekday Column Headers */}
              <div className="calendar-grid-scroll" role="region" aria-label="Monthly calendar" tabIndex={0}>
              <div className="calendar-weekdays grid grid-cols-7 text-center py-3 text-xs font-medium uppercase tracking-wider">
                <span className="text-rose-600 font-medium">Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span className="text-slate-800 font-medium">Sat</span>
              </div>

              {/* 35/42 Days Grid Cells Organized into Clean 2-Tier Weekly Rows */}
              <div className="calendar-weeks divide-y divide-slate-100">
                {calendarWeeks.map((week) => (
                  <div key={week.weekNumber} className="calendar-week relative min-h-[120px] sm:min-h-[132px] flex flex-col justify-start">
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
                            aria-label={`${formatDateDisplay(day.dateStr)}${day.isToday ? ', today' : ''}, ${day.activitiesCount} activities`}
                            aria-current={day.isToday ? "date" : undefined}
                            onClick={(e) => {
                              const allDayActs = filteredActivities.filter(a => isActivityOnDate(a, day.dateStr));
                              if (allDayActs.length > 0) {
                                handleOpenDayPopover(e, day.dateStr);
                              } else if (canCreate) {
                                if (onNavigate) {
                                  onNavigate("sundaycycle");
                                } else {
                                  handleOpenCreateModal(day.dateStr);
                                }
                              }
                            }}
                            className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full transition-all cursor-pointer ${
                              day.isToday
                                ? "bg-amber-400 text-slate-950 font-medium shadow-md ring-2 ring-amber-300"
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
                              className="text-[12px] font-medium text-slate-600 hover:text-indigo-950 bg-slate-100 hover:bg-indigo-100 border border-slate-200/70 px-1.5 py-0.5 rounded-full cursor-pointer transition-colors shadow-2xs"
                              title="Click to view all activities on this date"
                            >
                              {day.activitiesCount}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* One bar for each full schedule; matching events share that bar. */}
                    {week.multiDaySegments.length > 0 && (
                      <div className="relative z-10 grid grid-cols-7 gap-y-1 px-1.5 py-1 pointer-events-auto">
                        {groupedCalendarWeeks[week.weekNumber].map(({ key, segment, activities }) => {
                          const isSelected = activities.some(activity => activity === activeInspectorItem);

                          return (
                            <button type="button"
                              key={key}
                              data-schedule-count={activities.length}
                              aria-pressed={isSelected}
                              data-kind={segment.activity.type}
                              data-selected={isSelected}
                              aria-haspopup={activities.length > 1 ? "dialog" : undefined}
                              onClick={() => activities.length > 1 ? setSelectedScheduleKey(key) : setSelectedActivity(segment.activity)}
                              style={{
                                gridColumnStart: segment.startCol,
                                gridColumnEnd: segment.endCol + 1,
                              }}
                              className={`calendar-activity calendar-span h-[28px] text-[12px] font-medium px-3 flex items-center justify-between transition-all cursor-pointer truncate ${
                                segment.isStartOfEvent ? "rounded-l-xl" : "rounded-l-none pl-2 border-l-2 border-dashed border-white/40"
                              } ${
                                segment.isEndOfEvent ? "rounded-r-xl" : "rounded-r-none pr-2 border-r-2 border-dashed border-white/40"
                              } ${isSelected ? "ring-2 ring-amber-400 ring-offset-1 z-20 shadow-md" : ""}`}
                              title={`${activities.length > 1 ? `${activities.length} activities` : segment.activity.title}: ${formatDateDisplay(segment.activity.date_str)} – ${formatDateDisplay(segment.activity.end_date_str || '')} (${segment.activity.time_formatted})`}
                            >
                              <div className="flex items-center gap-1.5 truncate min-w-0">
                                {segment.isStartOfEvent && <CalendarIcon className="w-3.5 h-3.5 shrink-0 text-amber-300" />}
                                {!segment.isStartOfEvent && <span className="text-[12px] opacity-75 font-mono">↳</span>}
                                <span className="truncate">{activities.length > 1 ? `${activities.length} activities · View all` : segment.activity.title}</span>
                              </div>

                              <span className="text-[12px] font-medium bg-black/30 px-2 py-0.5 rounded-md text-white/95 shrink-0 ml-2 uppercase tracking-tighter">
                                {segment.isStartOfEvent && segment.isEndOfEvent
                                  ? `${segment.spanLength} Days Range`
                                  : (segment.isStartOfEvent ? "Starts" : (segment.isEndOfEvent ? "Ends" : "Ongoing"))}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* TIER 2: DEDICATED 7-COLUMN SLOTS FOR SINGLE-DAY ACTIVITIES */}
                    <div className="relative z-10 grid grid-cols-7 gap-1 p-1.5 flex-1 pointer-events-auto">
                      {week.days.map((day, dIdx) => {
                        const dayActivities = week.dailyActivitiesMap[dIdx] || [];
                        const visibleMultiCount = groupedCalendarWeeks[week.weekNumber].filter(
                          ({ segment }) => (dIdx + 1) >= segment.startCol && (dIdx + 1) <= segment.endCol
                        ).length;
                        const maxSingleToShow = Math.max(0, 2 - visibleMultiCount);
                        const visibleSingle = dayActivities.slice(0, maxSingleToShow);

                        return (
                          <div key={dIdx} className="space-y-1 min-w-0 flex flex-col justify-start">
                            {visibleSingle.map((act) => {
                              const isSelected = activeInspectorItem?.id === act.id;

                              return (
                                <button type="button" data-guide="calendar-inspect"
                                  key={act.id}
                                  aria-pressed={isSelected}
                                  data-kind={act.type}
                                  data-selected={isSelected}
                                  onClick={() => setSelectedActivity(act)}
                                  className={`calendar-activity w-full text-left rounded-md px-2 py-1.5 text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1 truncate ${
                                    isSelected ? "ring-2 ring-amber-400 ring-offset-1 z-20 shadow-md" : ""
                                  }`}
                                  title={`${act.title} (${act.time_formatted})`}
                                >
                                  {act.type === "church_event" && <CalendarIcon className="w-3 h-3 shrink-0" />}
                                  {act.type === "saturday_duty" && <CalendarCheck className="w-3 h-3 shrink-0 text-amber-300" />}
                                  {act.type === "dishwashing" && <Utensils className="w-3 h-3 shrink-0 text-teal-200" />}
                                  {act.type === "bible_study" && <BookOpen className="w-3 h-3 shrink-0 text-purple-200" />}
                                  {act.type === "birthday" && <Cake className="w-3 h-3 shrink-0 text-rose-200" />}
                                  <span className="truncate">{act.title.replace("Saturday Duty: ", "").replace("Dishwashing: ", "").replace("Bible Study: ", "").replace("Birthday:", "")}</span>
                                </button>
                              );
                            })}
                            {dayActivities.length > visibleSingle.length && <button type="button"
                              className="calendar-week-more rounded-md px-1 py-1 text-xs"
                              onClick={event => handleOpenDayPopover(event, day.dateStr)}>
                              +{dayActivities.length - visibleSingle.length} more
                            </button>}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                ))}
              </div>
              </div>
            </div>
          ) : (
            /* AGENDA / TIMELINE LIST VIEW */
            <div className="space-y-3.5">
              {upcomingActivitiesList.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-xs text-slate-400 space-y-2">
                  <CalendarIcon className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="font-medium text-slate-600">No activities found matching your filters.</p>
                  <p className="text-[12px]">Try selecting "All Activities" or clearing your search query.</p>
                </div>
              ) : (
                agendaPage.items.map((act) => {
                  const isSelected = activeInspectorItem?.id === act.id;
                  const dateObj = new Date(act.date_str);
                  const monthName = dateObj.toLocaleString([], { month: "short" });
                  const dayNum = dateObj.getDate();
                  const isMulti = Boolean(act.is_multiday && act.end_date_str && act.end_date_str > act.date_str);

                  return (
                    <div data-guide="calendar-inspect"
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
                              <span className="text-[12px] font-medium uppercase text-rose-600 leading-none">
                                {monthName}
                              </span>
                              <span className="text-xs font-medium text-slate-900 leading-tight mt-0.5">
                                {act.date_str.split("-")[2]} → {act.end_date_str.split("-")[2]}
                              </span>
                              <span className="text-[7px] font-medium text-slate-400 uppercase">Multi-Day</span>
                            </>
                          ) : (
                            <>
                              <span className="text-[12px] font-medium uppercase text-rose-600 leading-none">{monthName}</span>
                              <span className="text-lg font-medium text-slate-900 leading-tight">{dayNum}</span>
                            </>
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[12px] font-medium px-2 py-0.5 rounded-md text-white uppercase tracking-wide"
                              style={{ backgroundColor: act.badge_color }}
                            >
                              {act.type.replace("_", " ")}
                            </span>
                            {isMulti && (
                              <span className="text-[12px] font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wide">
                                Multi-Day Range
                              </span>
                            )}
                            <h3 className="text-sm font-semibold text-slate-900 truncate">{act.title}</h3>
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
                                  <UserCheck className="w-3.5 h-3.5 text-amber-500" />
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
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAttendanceModalEvent(act.raw_data);
                              }}
                              className="bg-purple-900 hover:bg-purple-800 text-white font-medium px-3 py-1.5 rounded-xl text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                              title="Mark Present / Event Attendance"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-purple-300" />
                              <span>Attendance</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRsvp(act.raw_data.id);
                              }}
                              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-medium px-3.5 py-1.5 rounded-xl text-xs shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>RSVP ({act.rsvp_count || 0})</span>
                            </button>
                          </div>
                        )}
                        {act.type === "birthday" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBirthdayModal(act.raw_data);
                            }}
                            className="bg-rose-500 hover:bg-rose-600 text-white font-medium px-3 py-1.5 rounded-xl text-xs shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
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
              <Pagination label="activities" page={agendaPage.page} pageSize={agendaPage.pageSize} total={agendaPage.total} onPageChange={agendaPage.setPage} onPageSizeChange={agendaPage.setPageSize} loading={loading} />
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: UNIFIED ACTIVITY INSPECTOR & DETAILS PANEL */}
        <div className="calendar-details-column lg:col-span-5 xl:col-span-4 space-y-6">
          {/* INSPECTOR CONTAINER */}
          <div className="calendar-details rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="calendar-title-icon p-2.5 rounded-xl">
                  <CalendarIcon className="w-4 h-4" />
                </span>
                <div>
                  <h3 data-guide="calendar-details" className="font-semibold text-sm text-slate-900">Activity details</h3>
                  <p className="text-xs text-slate-400 mt-1">Schedule, people & next steps</p>
                </div>
              </div>
              {activeInspectorItem && (
                <span
                  className="text-[12px] font-medium px-2.5 py-0.5 rounded-full text-white uppercase shadow-2xs"
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
                  <h4 className="text-base font-semibold text-slate-900 leading-snug">
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
                      <div className="flex items-center gap-2 font-medium text-slate-900 text-xs flex-wrap">
                        <CalendarIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>
                          {formatDateDisplay(activeInspectorItem.date_str)} – {formatDateDisplay(activeInspectorItem.end_date_str)}
                        </span>
                        <span className="text-[12px] bg-amber-100 text-amber-900 font-medium px-2 py-0.5 rounded-md uppercase tracking-wider ml-auto">
                          Multi-Day Range
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 font-medium text-[12px] pl-6">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          {formatTime12h(activeInspectorItem.start_time_iso)} (Start) to {formatTime12h(activeInspectorItem.end_time_iso)} (End)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 font-medium text-slate-900 text-xs">
                        <CalendarIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>{formatDateDisplay(activeInspectorItem.date_str)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 font-medium text-[12px] pl-6">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{activeInspectorItem.time_formatted}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200/70 space-y-2">
                    {activeInspectorItem.location && (
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Location: <strong className="text-slate-900 font-medium">{activeInspectorItem.location}</strong></span>
                      </div>
                    )}

                    {activeInspectorItem.ministry_name && (
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Tag className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Ministry / Unit: <strong className="text-slate-900 font-medium">{activeInspectorItem.ministry_name}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Specific Details based on Type */}
                {/* 1. Saturday Duty / Dishwashing Leader Info */}
                {(activeInspectorItem.type === "saturday_duty" || activeInspectorItem.type === "dishwashing" || activeInspectorItem.type === "bible_study") && activeInspectorItem.leader_name && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <span className="text-[12px] text-slate-400 font-medium block uppercase">Point Person / Leader</span>
                        <span className="font-medium text-slate-900">{activeInspectorItem.leader_name}</span>
                      </div>
                    </div>
                    {activeInspectorItem.leader_phone && (
                      <a 
                        href={`tel:${activeInspectorItem.leader_phone}`}
                        className="text-[12px] text-indigo-900 font-mono font-medium bg-indigo-100/70 hover:bg-indigo-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
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
                    <span className="text-[12px] font-medium uppercase text-teal-900 block mb-1">Responsibilities / Checklist</span>
                    <p className="text-[12px] text-teal-950/80 leading-relaxed font-medium">
                      {activeInspectorItem.checklist}
                    </p>
                  </div>
                )}

                {canCreate && activeInspectorItem.type === "church_event" && <Button variant="secondary" className="w-full" onClick={() => setInvitationEvent(activeInspectorItem.raw_data)}><Send size={15} />Invitation Links & Responses</Button>}
                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
                  {activeInspectorItem.type === "church_event" && (
                    <>
                      <button
                        onClick={() => setAttendanceModalEvent(activeInspectorItem.raw_data)}
                        className="w-full bg-purple-900  text-white font-medium py-2.5 px-4 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      >
                        <UserCheck className="w-4 h-4 text-purple-300" />
                        <span>Event Attendance & Check-In</span>
                      </button>
                      <button
                        onClick={() => handleRsvp(activeInspectorItem.raw_data.id)}
                        className="w-full bg-amber-400 hover:brightness-105 text-slate-950 font-medium py-2.5 px-4 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>RSVP ({activeInspectorItem.rsvp_count || 0})</span>
                      </button>
                    </>
                  )}

                  {activeInspectorItem.type === "birthday" && (
                    <button
                      onClick={() => handleOpenBirthdayModal(activeInspectorItem.raw_data)}
                      className="w-full bg-rose-500 hover:bg-rose-600 text-white font-medium py-2.5 px-4 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <Gift className="w-4 h-4" />
                      <span>Send Birthday Blessing</span>
                    </button>
                  )}

                  {activeInspectorItem.type === "saturday_duty" && (
                    <div className="text-slate-500 text-[12px] flex items-center gap-1.5 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200 w-full justify-center">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Saturday Cleaning: <strong>{activeInspectorItem.members_count || 0}</strong> disciples assigned</span>
                    </div>
                  )}

                  {activeInspectorItem.type === "dishwashing" && (
                    <div className="text-slate-500 text-[12px] flex items-center gap-1.5 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200 w-full justify-center">
                      <Droplets className="w-4 h-4 text-teal-600" />
                      <span>Kitchen Roster: <strong>{activeInspectorItem.members_count || 5}</strong> volunteers active</span>
                    </div>
                  )}

                  {activeInspectorItem.type === "bible_study" && (
                    <div className="text-slate-500 text-[12px] flex items-center gap-1.5 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-200 w-full justify-center">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      <span>Discipleship Group: <strong>{activeInspectorItem.members_count || 0}</strong> disciples enrolled</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <CalendarIcon className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-medium text-slate-600">No activity selected</p>
                <p className="text-[12px]">Click any event badge on the calendar to view its details here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE EVENT MODAL */}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div data-modal-header className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                <span>Schedule New Ministry Event</span>
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Youth Encounter Night, Fellowship Lunch"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 font-medium"
                />
              </div>

              <EventMinistryPicker ministries={ministries} value={formData.ministry_ids} label="Host Ministries" onChange={ids => setFormData({ ...formData, ministry_ids: ids, ministry_id: ids[0] ? String(ids[0]) : '' })} />

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
                <label className="block font-medium text-slate-700 mb-1">Location / Venue *</label>
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
                <label className="block font-medium text-slate-700 mb-1">Description & Details</label>
                <textarea
                  rows={3}
                  placeholder="Provide instructions, speaker details, or reminders..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 font-medium"
                ></textarea>
              </div>

              <div data-modal-footer className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-medium text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-md cursor-pointer"
                >
                  Publish Event
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* SEND BIRTHDAY BLESSING MODAL */}
      {selectedBirthday && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div data-modal-header className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Cake className="w-5 h-5 text-rose-500" />
                <span>Send Birthday Blessing to {selectedBirthday.first_name}</span>
              </h2>
              <button onClick={() => setSelectedBirthday(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 text-slate-800">
                <span className="font-medium block text-rose-950">Pastoral Care Milestone</span>
                <span>{selectedBirthday.first_name} {selectedBirthday.last_name} ({selectedBirthday.ministry_name || "General Member"}) turning {selectedBirthday.turning_age} years old on {selectedBirthday.birth_month}/{selectedBirthday.birth_day}.</span>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Pastoral Blessing Message</label>
                <textarea
                  rows={4}
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 font-medium"
                ></textarea>
              </div>

              {greetingSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-900 font-medium rounded-xl border border-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Blessing broadcasted to church wall!</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBirthday(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-medium text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={sendingGreeting || greetingSuccess}
                  onClick={handleSendBirthdayGreeting}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-medium shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingGreeting ? "Sending..." : "Post Blessing"}</span>
                </button>
              </div>
            </div>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* FLOATING GOOGLE-CALENDAR STYLE DAY POPOVER */}
      {selectedScheduleActivities.length > 0 && <Dialog title="Activities with this schedule" onClose={() => setSelectedScheduleKey(null)}
        description={`${formatDateDisplay(selectedScheduleActivities[0].date_str)} – ${formatDateDisplay(selectedScheduleActivities[0].end_date_str || '')} · ${selectedScheduleActivities[0].time_formatted}`}
        footer={<Button onClick={() => setSelectedScheduleKey(null)}>Close</Button>}>
        <div className="space-y-2">
          {selectedScheduleActivities.map(activity => <button key={activity.id} type="button"
            data-guide="calendar-inspect" className="ui-input text-left hover:bg-indigo-50"
            onClick={() => { setSelectedActivity(activity); setSelectedScheduleKey(null); }}>
            <span className="block text-sm font-medium text-charcoal break-words">{activity.title}</span>
            <span className="block text-xs text-muted mt-1">{activity.type.replace(/_/g, ' ')}{activity.location ? ` · ${activity.location}` : ''}</span>
          </button>)}
        </div>
      </Dialog>}
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
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
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
                  <div data-guide="calendar-inspect"
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
                      isSelected ? "ring-2 ring-amber-400 ring-offset-1 font-medium" : ""
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

                      <span className="text-xs font-medium text-slate-900 truncate">
                        {act.title.replace("Saturday Duty: ", "").replace("Dishwashing: ", "").replace("Bible Study: ", "").replace("Birthday:", "")}
                      </span>
                    </div>

                    {isMulti ? (
                      <span className="text-[12px] font-medium uppercase bg-amber-200/60 text-amber-950 px-1.5 py-0.5 rounded shrink-0">
                        Multi-Day
                      </span>
                    ) : (
                      <span className="text-[12px] font-medium text-slate-500 shrink-0">
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
                  className="w-full py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-[12px] flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
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

      {invitationEvent && <EventInvitationsModal event={invitationEvent} onClose={() => setInvitationEvent(null)} />}
      {/* Event Attendance & Check-In Modal */}
      <EventAttendanceModal
        event={attendanceModalEvent}
        isOpen={!!attendanceModalEvent}
        onClose={() => setAttendanceModalEvent(null)}
      />
    </div>
  );
};

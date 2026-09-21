import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { api } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { EventItem, EventAttendeeItem, Ministry, Member } from "../../types";
import {
  CheckCircle2, Clock, MapPin, Search, Users,
  UserCheck, UserPlus, Sparkles, ChevronDown, Check,
  RefreshCw, X, Undo2, Loader2, Layers, Tag,
  ListChecks, SlidersHorizontal, CheckSquare, AlertCircle, UserX,
  HelpCircle
} from "lucide-react";
import { TableSkeleton } from "../common/SkeletonLoader";

interface EventAttendanceCheckInViewProps {
  initialEventId?: number;
}

export const EventAttendanceCheckInView: React.FC<EventAttendanceCheckInViewProps> = ({
  initialEventId
}) => {
  const { user, ministries } = useAuth();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(initialEventId || null);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);
  const [attendees, setAttendees] = useState<EventAttendeeItem[]>([]);
  const [loadingRoster, setLoadingRoster] = useState<boolean>(false);
  const [markingId, setMarkingId] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMinistry, setFilterMinistry] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent" | "excused" | "unmarked">("all");

  // Quick Fast Batch Attendance Mode (Batch Roll Call)
  const [isFastMode, setIsFastMode] = useState<boolean>(false);
  const [fastModeType, setFastModeType] = useState<"absent_rest_present" | "present_rest_absent" | "present_only">("absent_rest_present");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
  const [batchSubmitting, setBatchSubmitting] = useState<boolean>(false);

  // Mark Absent / Excused Modal state
  const [absentModalMember, setAbsentModalMember] = useState<EventAttendeeItem | null>(null);
  const [absentStatusType, setAbsentStatusType] = useState<"absent" | "excused">("absent");
  const [absentPresetReason, setAbsentPresetReason] = useState<string>("Sick / Not Feeling Well");
  const [absentCustomNotes, setAbsentCustomNotes] = useState<string>("");

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Walk-in modal state
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [walkInSearch, setWalkInSearch] = useState("");
  const [walkInMinistry, setWalkInMinistry] = useState("all");

  // Fetch events list
  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const data = await api.getEvents();
      const sorted = (data || []).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      setEvents(sorted);
      if (!selectedEventId && sorted.length > 0) {
        const now = new Date().getTime();
        const upcomingOrToday = sorted.find(e => new Date(e.start_time).getTime() >= now - 86400000) || sorted[0];
        setSelectedEventId(upcomingOrToday.id);
      }
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Fetch roster when selected event changes
  const fetchRoster = async (eventId: number) => {
    setLoadingRoster(true);
    try {
      const data = await api.getEventAttendanceRoster(eventId);
      setAttendees(data.attendees || []);
    } catch (err) {
      console.error("Failed to load event roster:", err);
    } finally {
      setLoadingRoster(false);
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      fetchRoster(selectedEventId);
    } else {
      setAttendees([]);
    }
  }, [selectedEventId]);

  // Clear selections when event or ministry filter changes
  useEffect(() => {
    setSelectedMemberIds(new Set());
  }, [selectedEventId, filterMinistry]);

  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Mark single member present
  const handleMarkPresent = async (item: EventAttendeeItem) => {
    if (!selectedEventId || markingId) return;
    setMarkingId(item.member_id);
    try {
      await api.markEventAttendance(selectedEventId, {
        member_id: item.member_id,
        status: "attended",
        notes: `Event check-in by ${user?.name || "Coordinator"}`
      });
      showToast(`✓ ${item.first_name} ${item.last_name} marked present!`);
      await fetchRoster(selectedEventId);
    } catch (err: any) {
      showToast(err.message || "Failed to mark present", "error");
    } finally {
      setMarkingId(null);
    }
  };

  // Quick mark absent
  const handleQuickMarkAbsent = async (item: EventAttendeeItem) => {
    if (!selectedEventId || markingId) return;
    setMarkingId(item.member_id);
    try {
      await api.markEventAttendance(selectedEventId, {
        member_id: item.member_id,
        status: "absent",
        reason: "Absent from event"
      });
      showToast(`Marked ${item.first_name} ${item.last_name} absent`);
      await fetchRoster(selectedEventId);
    } catch (err: any) {
      showToast(err.message || "Failed to mark absent", "error");
    } finally {
      setMarkingId(null);
    }
  };

  // Open absent / excused modal
  const handleOpenAbsentModal = (item: EventAttendeeItem, type: "absent" | "excused" = "absent") => {
    setAbsentModalMember(item);
    setAbsentStatusType(type);
    setAbsentPresetReason(type === "absent" ? "Unexcused / No Notice" : "Sick / Not Feeling Well");
    setAbsentCustomNotes("");
  };

  // Save absent or excused from modal
  const handleSaveAbsentOrExcused = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !absentModalMember) return;
    try {
      setMarkingId(absentModalMember.member_id);
      const combinedReason = [absentPresetReason, absentCustomNotes.trim()].filter(Boolean).join(" — ");
      await api.markEventAttendance(selectedEventId, {
        member_id: absentModalMember.member_id,
        status: absentStatusType,
        reason: combinedReason
      });
      showToast(`✓ ${absentModalMember.first_name} marked as ${absentStatusType === "absent" ? "Absent" : "Excused"}!`);
      setAbsentModalMember(null);
      setAbsentCustomNotes("");
      await fetchRoster(selectedEventId);
    } catch (err: any) {
      showToast(err.message || `Failed to mark ${absentStatusType}`, "error");
    } finally {
      setMarkingId(null);
    }
  };

  // Undo attendance mark
  const handleUndoAttendance = async (item: EventAttendeeItem) => {
    if (!selectedEventId || markingId) return;
    setMarkingId(item.member_id);
    try {
      await api.markEventAttendance(selectedEventId, {
        member_id: item.member_id,
        status: "registered"
      });
      showToast(`Reset attendance for ${item.first_name}`);
      await fetchRoster(selectedEventId);
    } catch (err: any) {
      showToast(err.message || "Failed to reset attendance", "error");
    } finally {
      setMarkingId(null);
    }
  };

  // Open Walk-In Modal
  const handleOpenWalkIn = async () => {
    setIsWalkInModalOpen(true);
    if (allMembers.length === 0) {
      setLoadingMembers(true);
      try {
        const mems = await api.getMembers();
        setAllMembers(mems || []);
      } catch (err) {
        console.error("Failed to load all members for walk-in:", err);
      } finally {
        setLoadingMembers(false);
      }
    }
  };

  // Add Walk-In Attendee
  const handleAddWalkInMember = async (member: Member) => {
    if (!selectedEventId || markingId) return;
    setMarkingId(member.id);
    try {
      await api.markEventAttendance(selectedEventId, {
        member_id: member.id,
        status: "attended"
      });
      await fetchRoster(selectedEventId);
      setIsWalkInModalOpen(false);
      showToast(`✓ Added ${member.first_name} ${member.last_name} as Walk-In!`);
    } catch (err: any) {
      console.error("Failed to add walk-in:", err);
      showToast(err.message || "Failed to add walk-in", "error");
    } finally {
      setMarkingId(null);
    }
  };

  // Batch Scope List (all attendees matching current ministry filter)
  const batchScopeList = useMemo(() => {
    return attendees.filter(item => {
      if (filterMinistry !== "all") {
        if (String(item.ministry_id) !== filterMinistry && item.ministry_name?.toLowerCase() !== filterMinistry.toLowerCase()) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
      const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [attendees, filterMinistry]);

  // Fast Batch Selection Actions
  const toggleSelectMember = (memberId: number) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const selectAllFiltered = (list: EventAttendeeItem[]) => {
    const next = new Set(selectedMemberIds);
    list.forEach(item => next.add(item.member_id));
    setSelectedMemberIds(next);
  };

  const clearSelection = () => {
    setSelectedMemberIds(new Set());
  };

  const invertSelection = (list: EventAttendeeItem[]) => {
    const next = new Set<number>();
    list.forEach(item => {
      if (!selectedMemberIds.has(item.member_id)) {
        next.add(item.member_id);
      }
    });
    setSelectedMemberIds(next);
  };

  const handleApplyBatchAttendance = async (list: EventAttendeeItem[] = batchScopeList) => {
    if (!selectedEventId) {
      showToast("Please select an event first.", "error");
      return;
    }
    const targetList = list.length > 0 ? list : batchScopeList;
    if (targetList.length === 0) {
      showToast("No members found in the current event roster to mark.", "error");
      return;
    }

    try {
      setBatchSubmitting(true);
      let present_ids: number[] = [];
      let absent_ids: number[] = [];

      if (fastModeType === "absent_rest_present") {
        // Selected are ABSENT/Pending, all other members in current scope are PRESENT
        targetList.forEach(item => {
          if (selectedMemberIds.has(item.member_id)) {
            absent_ids.push(item.member_id);
          } else {
            present_ids.push(item.member_id);
          }
        });
      } else if (fastModeType === "present_rest_absent") {
        // Selected are PRESENT, all other members in current scope are ABSENT/Pending
        targetList.forEach(item => {
          if (selectedMemberIds.has(item.member_id)) {
            present_ids.push(item.member_id);
          } else {
            absent_ids.push(item.member_id);
          }
        });
      } else {
        // present_only: only mark selected as present
        present_ids = Array.from(selectedMemberIds);
      }

      await api.batchMarkEventAttendance(selectedEventId, {
        present_ids,
        absent_ids,
        notes: `Batch roll call for ${selectedEvent?.title || "Special Event"}`
      });

      showToast(`✓ Attendance updated successfully (${present_ids.length} Present, ${absent_ids.length} Pending/Absent)`);
      setSelectedMemberIds(new Set());
      await fetchRoster(selectedEventId);
    } catch (err: any) {
      showToast(err.message || "Failed to save batch attendance", "error");
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Statistics
  const totalRosterCount = attendees.length;
  const presentCount = attendees.filter(r => r.status === "attended").length;
  const absentCount = attendees.filter(r => r.status === "absent" || r.attendance_notes?.includes("[ABSENT]")).length;
  const excusedCount = attendees.filter(r => r.status === "excused" || r.attendance_notes?.includes("[EXCUSED]")).length;
  const unmarkedCount = totalRosterCount - presentCount - absentCount - excusedCount;
  const attendanceRate = totalRosterCount > 0 ? Math.round((presentCount / totalRosterCount) * 100) : 0;

  // Roster Filtering
  const filteredAttendees = useMemo(() => {
    return attendees.filter(item => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${item.first_name} ${item.last_name}`.toLowerCase();
        const ministry = (item.ministry_name || "").toLowerCase();
        const phone = (item.contact_phone || "").toLowerCase();
        if (!fullName.includes(q) && !ministry.includes(q) && !phone.includes(q)) return false;
      }
      // Ministry
      if (filterMinistry !== "all") {
        if (String(item.ministry_id) !== filterMinistry && item.ministry_name?.toLowerCase() !== filterMinistry.toLowerCase()) {
          return false;
        }
      }
      // In batch roll call mode, status filter is ignored so the user sees all members in the scope
      if (isFastMode) {
        return true;
      }
      // Status resolution
      const isPresent = item.status === "attended";
      const isAbsent = item.status === "absent" || item.attendance_notes?.includes("[ABSENT]");
      const isExcused = item.status === "excused" || item.attendance_notes?.includes("[EXCUSED]");
      const isUnmarked = !isPresent && !isAbsent && !isExcused;

      let matchesStatus = true;
      if (statusFilter === "present") matchesStatus = isPresent;
      else if (statusFilter === "absent") matchesStatus = !!isAbsent;
      else if (statusFilter === "excused") matchesStatus = !!isExcused;
      else if (statusFilter === "unmarked") matchesStatus = isUnmarked;

      return matchesStatus;
    }).sort((a, b) => {
      const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
      const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [attendees, searchQuery, filterMinistry, statusFilter, isFastMode]);

  // Walk-in candidates (members not yet in attendees roster)
  const walkInCandidates = useMemo(() => {
    const rosterMemberIds = new Set(attendees.map(r => r.member_id));
    return allMembers.filter(m => {
      if (rosterMemberIds.has(m.id)) return false;
      if (walkInSearch.trim()) {
        const q = walkInSearch.toLowerCase();
        const full = `${m.first_name} ${m.last_name}`.toLowerCase();
        if (!full.includes(q) && !(m.contact_phone || "").includes(q)) return false;
      }
      if (walkInMinistry !== "all") {
        if (String(m.ministry_id) !== walkInMinistry) return false;
      }
      return true;
    }).sort((a, b) => {
      const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
      const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [allMembers, attendees, walkInSearch, walkInMinistry]);

  // Format local date
  const formatEventDate = (isoStr: string) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatEventTime = (isoStr: string) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  return (
    <div className={`space-y-6 ${isFastMode ? "pb-36 sm:pb-44" : "pb-12"}`}>

      {/* Toast Feedback Banner */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold text-white border animate-in slide-in-from-bottom-4 ${
          toastMsg.type === "success" ? "bg-emerald-900 border-emerald-700" : "bg-rose-900 border-rose-700"
        }`}>
          {toastMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TOP HERO: Special Event Attendance Overview (Matched to DPC ChMS Design System) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-white/10">
        <img
          src="/container_bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35 mix-blend-screen pointer-events-none"
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-black uppercase tracking-wider backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Special Event Attendance Kiosk</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Event Attendance Checking
            </h1>
            <p className="text-xs text-indigo-200/90 max-w-xl leading-relaxed">
              Live registration desk check-in for church anniversaries, youth camps, conferences, seminars, and ministry fellowships.
            </p>
          </div>

          {/* Dedicated Event Selector */}
          <div className="flex flex-col gap-2 bg-white/10 p-3 rounded-2xl border border-white/15 backdrop-blur-md min-w-[280px] sm:min-w-[340px]">
            <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              Select Church Event
            </label>
            <div className="relative">
              <select
                value={selectedEventId || ""}
                onChange={(e) => setSelectedEventId(Number(e.target.value))}
                disabled={loadingEvents || events.length === 0}
                className="w-full bg-indigo-950/95 text-white font-bold text-xs p-2.5 pr-8 rounded-xl border border-white/20 focus:outline-none focus:border-amber cursor-pointer appearance-none truncate"
              >
                {events.length === 0 && <option value="">No events recorded</option>}
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({formatEventDate(ev.start_time)})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-amber-300 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selectedEvent && (
              <div className="flex items-center gap-3 text-[11px] text-indigo-200/90 pt-1 border-t border-white/10">
                <span className="flex items-center gap-1 font-medium">
                  <Clock className="w-3 h-3 text-amber-400" />
                  {formatEventTime(selectedEvent.start_time)}
                </span>
                {selectedEvent.location && (
                  <span className="flex items-center gap-1 font-medium truncate">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    {selectedEvent.location}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Statistics Strip (Matched to Sunday Attendance Standard) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Present Today</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-700">
            {loadingRoster ? "..." : presentCount.toLocaleString()} <span className="text-xs font-normal text-stone-400">/ {totalRosterCount}</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {attendanceRate}% Turnout Rate
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Absent / Excused</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-rose-700">
            {loadingRoster ? "..." : (absentCount + excusedCount).toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-600 font-semibold mt-1">
            {absentCount} Absent • {excusedCount} Excused
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pending / Unmarked</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-700">
            {loadingRoster ? "..." : unmarkedCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-600 font-semibold mt-1">Not yet marked</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo">Turnout Progress</span>
              <span className="text-xs font-black text-indigo">{attendanceRate}%</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden my-2 border border-stone-200/60">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, attendanceRate)}%` }}
              ></div>
            </div>
          </div>
          <div className="text-[11px] text-stone-500 font-semibold">
            {presentCount} of {totalRosterCount} marked present
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar (Matched to DPC ChMS Toolbar) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-stone-200 space-y-4">
        {isFastMode ? (
          /* When in Batch Roll Call Mode: Show contextual banner instead of confusing status filters */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-indigo-950 font-bold bg-indigo-50/80 border border-indigo-100 px-3 py-2 rounded-2xl flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
              <span>
                Batch Roll Call Active • Showing all {batchScopeList.length} members in current scope. Use the search bar inside the roll call toolbar below to find members.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsFastMode(false);
                setSelectedMemberIds(new Set());
              }}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-charcoal/80 font-bold text-xs transition-all cursor-pointer shrink-0"
            >
              Exit Batch Mode
            </button>
          </div>
        ) : (
          /* Normal Mode: Search Box + Ministry & Status Filter Pills */
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status Quick Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-black text-charcoal/50 uppercase tracking-wider shrink-0 mr-1">Status:</span>

              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 cursor-pointer ${statusFilter === "all"
                  ? "bg-charcoal text-white shadow-xs"
                  : "bg-gray-100 hover:bg-gray-200 text-charcoal/70"
                  }`}
              >
                All ({totalRosterCount})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("present")}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 flex items-center gap-1 cursor-pointer ${statusFilter === "present"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                  }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Present ({presentCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("absent")}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 flex items-center gap-1 cursor-pointer ${statusFilter === "absent"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
                  }`}
              >
                <UserX className="w-3 h-3" />
                <span>Absent ({absentCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("excused")}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 flex items-center gap-1 cursor-pointer ${statusFilter === "excused"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                  }`}
              >
                <HelpCircle className="w-3 h-3" />
                <span>Excused ({excusedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("unmarked")}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 cursor-pointer ${statusFilter === "unmarked"
                  ? "bg-gray-600 text-white shadow-xs"
                  : "bg-gray-100 hover:bg-gray-200 text-charcoal/60"
                  }`}
              >
                Unmarked ({unmarkedCount})
              </button>
            </div>

            {/* Search Box & Ministry Dropdown */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:w-64 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search attendee, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-7 py-2 bg-ivory-light border border-charcoal/15 rounded-xl text-xs font-medium text-charcoal focus:outline-none focus:border-indigo transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={filterMinistry}
                onChange={(e) => setFilterMinistry(e.target.value)}
                className="bg-ivory-light border border-charcoal/15 text-charcoal text-xs font-semibold py-2 px-3 rounded-xl focus:outline-none focus:border-indigo cursor-pointer"
              >
                <option value="all">All Ministries</option>
                {ministries.map(m => (
                  <option key={m.id} value={String(m.id)}>{m.name}</option>
                ))}
              </select>

              {/* Quick Walk-In Button */}
              <button
                onClick={handleOpenWalkIn}
                disabled={!selectedEventId}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo hover:bg-indigo-900 active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4 text-amber" />
                <span>+ Add Walk-In</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => selectedEventId && fetchRoster(selectedEventId)}
                disabled={loadingRoster || !selectedEventId}
                className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl transition cursor-pointer"
                title="Refresh Roster"
              >
                <RefreshCw className={`w-4 h-4 ${loadingRoster ? "animate-spin text-indigo" : ""}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MAIN ATTENDANCE ROSTER LIST */}
      {loadingRoster && attendees.length === 0 ? (
        <TableSkeleton rows={8} columns={5} />
      ) : !selectedEventId ? (
        <div className="bg-white rounded-3xl p-16 text-center text-stone-400 space-y-2 border border-stone-200 shadow-sm">
          <Users className="w-12 h-12 mx-auto text-stone-300" />
          <p className="font-bold text-charcoal">Please select an event above to view and check attendance.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden space-y-0">

          {/* Top Directory Header with Batch Roll Call Toggle */}
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3 bg-gradient-to-r from-gray-50/50 via-white to-gray-50/50">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-xs transition-colors ${
                isFastMode ? "bg-slate-900 text-amber-300" : "bg-indigo-50 text-indigo"
              }`}>
                {isFastMode ? <ListChecks className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-sm sm:text-base text-charcoal flex items-center gap-1.5">
                    <span>{selectedEvent?.title || "Event"} Attendance Roster</span>
                    <span className="text-xs font-normal text-charcoal/50">({filteredAttendees.length} members shown)</span>
                  </h2>
                  {isFastMode && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-slate-950 shadow-2xs">
                      Batch Mode Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-charcoal/50">
                  {isFastMode
                    ? "Batch Roll Call: Select absent/pending members (unselected are marked Present) or select present attendees."
                    : "Quickly mark event attendees: Check-In (Present), Absent Today, Excused (Travel/Sick), or Undo."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Toggle Batch Roll Call Button */}
              <button
                type="button"
                onClick={() => {
                  if (!isFastMode) {
                    setStatusFilter("all");
                  }
                  setIsFastMode(!isFastMode);
                  setSelectedMemberIds(new Set());
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 ${
                  isFastMode
                    ? "bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700"
                    : "bg-indigo hover:bg-indigo-700 text-white border border-indigo/20 shadow-xs"
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>{isFastMode ? "Exit Batch Roll Call" : "Batch Roll Call"}</span>
              </button>

              <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>

              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  {presentCount} Present
                </span>
                <span className="font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
                  {absentCount} Absent
                </span>
                <span className="font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                  {excusedCount} Excused
                </span>
              </div>
            </div>
          </div>

          {/* BATCH ROLL CALL TOOLBAR (Rendered when isFastMode is active) */}
          {isFastMode && (
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-5 text-white border-b border-slate-800 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              
              {/* Row 1: Mode Selection (Full-Width 3-Column Grid) */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" /> Roll Call Method:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">

                  {/* Mode A: Select Absent / Pending (Unselected = Present) */}
                  <button
                    type="button"
                    onClick={() => {
                      setFastModeType("absent_rest_present");
                      setSelectedMemberIds(new Set());
                    }}
                    className={`p-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer text-left ${
                      fastModeType === "absent_rest_present"
                        ? "bg-rose-600 text-white shadow-md ring-2 ring-rose-400"
                        : "bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <UserX className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-bold leading-tight">Mark Absentees (Exception)</div>
                      <div className="text-[10px] text-white/80 font-normal mt-0.5">Unselected = Present by Default</div>
                    </div>
                  </button>

                  {/* Mode B: Select Present (Unselected = Absent) */}
                  <button
                    type="button"
                    onClick={() => {
                      setFastModeType("present_rest_absent");
                      setSelectedMemberIds(new Set());
                    }}
                    className={`p-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer text-left ${
                      fastModeType === "present_rest_absent"
                        ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400"
                        : "bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-bold leading-tight">Mark Present Attendees</div>
                      <div className="text-[10px] text-white/80 font-normal mt-0.5">Unselected = Absent/Pending by Default</div>
                    </div>
                  </button>

                  {/* Mode C: Present Only */}
                  <button
                    type="button"
                    onClick={() => {
                      setFastModeType("present_only");
                      setSelectedMemberIds(new Set());
                    }}
                    className={`p-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-3 cursor-pointer text-left ${
                      fastModeType === "present_only"
                        ? "bg-sky-600 text-white shadow-md ring-2 ring-sky-400"
                        : "bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-bold leading-tight">Mark Selected Present Only</div>
                      <div className="text-[10px] text-white/80 font-normal mt-0.5">Keep unselected unchanged</div>
                    </div>
                  </button>

                </div>
              </div>

              {/* Row 2: Roll Call Search & Actions Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-800">

                {/* Search in Roll Call */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto flex-1 max-w-xl">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search member in roll call..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-400 text-xs focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Selection Helpers & Active Filter Tag */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15">
                    <button
                      type="button"
                      onClick={() => selectAllFiltered(filteredAttendees)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white hover:bg-white/15 transition-all cursor-pointer"
                      title="Select all members currently in list"
                    >
                      Select All ({filteredAttendees.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => clearSelection()}
                      disabled={selectedMemberIds.size === 0}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/15 disabled:opacity-40 transition-all cursor-pointer"
                    >
                      Clear ({selectedMemberIds.size})
                    </button>
                    <button
                      type="button"
                      onClick={() => invertSelection(filteredAttendees)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
                      title="Invert current check selection"
                    >
                      Invert
                    </button>
                  </div>

                  {searchQuery && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs">
                      <span>Filtered: <strong>{filteredAttendees.length}</strong> of {batchScopeList.length}</span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="hover:text-white ml-0.5 cursor-pointer"
                        title="Reset search filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* Row 3: Tip Banner & Save Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2 text-xs flex items-center justify-between flex-wrap gap-2 text-slate-300 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                    <span>
                      {fastModeType === "absent_rest_present" ? (
                        <><strong>Tip:</strong> Select members who are absent/not arrived. All unselected members will automatically be marked as <strong>Present</strong> upon saving.</>
                      ) : fastModeType === "present_rest_absent" ? (
                        <><strong>Tip:</strong> Select members who are present. All unselected members will automatically be marked as <strong>Absent/Pending</strong> upon saving.</>
                      ) : (
                        <><strong>Tip:</strong> Select members to mark as <strong>Present</strong> for this event.</>
                      )}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-300 shrink-0">
                    {selectedMemberIds.size} of {batchScopeList.length} in scope selected
                  </span>
                </div>

                {/* Primary Save Button */}
                <button
                  type="button"
                  onClick={() => handleApplyBatchAttendance(batchScopeList)}
                  disabled={batchSubmitting || batchScopeList.length === 0}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {batchSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Roll Call...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>
                        {fastModeType === "absent_rest_present"
                          ? `Save Roll Call (${selectedMemberIds.size} Absent, ${Math.max(0, batchScopeList.length - selectedMemberIds.size)} Present)`
                          : fastModeType === "present_rest_absent"
                            ? `Save Roll Call (${selectedMemberIds.size} Present, ${Math.max(0, batchScopeList.length - selectedMemberIds.size)} Absent)`
                            : `Save ${selectedMemberIds.size} Selected Present`}
                      </span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* Roster Table */}
          <div className="overflow-x-auto min-h-[160px]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-charcoal/60 font-bold uppercase text-[10px] tracking-wider">
                  {isFastMode && (
                    <th className="py-3 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={filteredAttendees.length > 0 && selectedMemberIds.size === filteredAttendees.length}
                        onChange={() => {
                          if (selectedMemberIds.size === filteredAttendees.length) clearSelection();
                          else selectAllFiltered(filteredAttendees);
                        }}
                        className="w-4 h-4 rounded text-indigo focus:ring-indigo/20 cursor-pointer"
                        title="Select All / Deselect All"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4">Church Member</th>
                  <th className="py-3 px-4">Ministry / Age Group</th>
                  <th className="py-3 px-4">RSVP Status</th>
                  <th className="py-3 px-4">Attendance Status</th>
                  <th className="py-3 px-4 text-right">
                    {isFastMode ? "Roll Call Target" : "Attendance Action"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAttendees.length === 0 ? (
                  <tr>
                    <td colSpan={isFastMode ? 6 : 5} className="py-12 text-center text-charcoal/50">
                      <AlertCircle className="w-8 h-8 text-charcoal/30 mx-auto mb-2" />
                      <p className="font-bold text-xs">No attendees found matching your search and filter criteria.</p>
                      {!isFastMode && (
                        <button
                          onClick={handleOpenWalkIn}
                          className="mt-3 px-4 py-2 bg-indigo/10 text-indigo font-bold rounded-xl text-xs hover:bg-indigo/20 cursor-pointer"
                        >
                          Add a Church Member as Walk-In
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredAttendees.map((item) => {
                    const isChecking = markingId === item.member_id;
                    const isPresent = item.status === "attended";
                    const isAbsent = item.status === "absent" || item.attendance_notes?.includes("[ABSENT]");
                    const isExcused = item.status === "excused" || item.attendance_notes?.includes("[EXCUSED]");
                    const isRegistered = item.status === "registered";
                    const isSelectedInBatch = selectedMemberIds.has(item.member_id);

                    // Roll Call Target outcome
                    let rollCallTarget: "mark_absent" | "default_present" | "mark_present" | "default_absent" | "unchanged" = "unchanged";
                    if (isFastMode) {
                      if (fastModeType === "absent_rest_present") {
                        rollCallTarget = isSelectedInBatch ? "mark_absent" : "default_present";
                      } else if (fastModeType === "present_rest_absent") {
                        rollCallTarget = isSelectedInBatch ? "mark_present" : "default_absent";
                      } else {
                        rollCallTarget = isSelectedInBatch ? "mark_present" : "unchanged";
                      }
                    }

                    return (
                      <tr
                        key={item.member_id}
                        onClick={isFastMode ? () => toggleSelectMember(item.member_id) : undefined}
                        className={`transition-colors ${
                          isFastMode
                            ? isSelectedInBatch
                              ? fastModeType === "absent_rest_present"
                                ? "bg-rose-50/70 hover:bg-rose-100/70 cursor-pointer"
                                : "bg-emerald-50/70 hover:bg-emerald-100/70 cursor-pointer"
                              : "hover:bg-indigo-50/30 cursor-pointer"
                            : isPresent
                              ? "bg-emerald-50/25 hover:bg-emerald-50/40"
                              : isAbsent
                                ? "bg-rose-50/25 hover:bg-rose-50/40"
                                : isExcused
                                  ? "bg-amber-50/25 hover:bg-amber-50/40"
                                  : "hover:bg-ivory/50"
                        }`}
                      >
                        {/* Checkbox Column for Fast Mode */}
                        {isFastMode && (
                          <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelectedInBatch}
                              onChange={() => toggleSelectMember(item.member_id)}
                              className={`w-5 h-5 rounded cursor-pointer transition-all ${
                                fastModeType === "absent_rest_present"
                                  ? "text-rose-600 focus:ring-rose-400"
                                  : "text-emerald-600 focus:ring-emerald-400"
                              }`}
                            />
                          </td>
                        )}

                        {/* Member Info */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border shrink-0 ${
                              isFastMode && isSelectedInBatch
                                ? fastModeType === "absent_rest_present"
                                  ? "bg-rose-200 text-rose-950 border-rose-400"
                                  : "bg-emerald-200 text-emerald-950 border-emerald-400"
                                : isPresent
                                  ? "bg-emerald-700 text-white border-emerald-600"
                                  : isAbsent
                                    ? "bg-rose-100 text-rose-900 border-rose-300"
                                    : isExcused
                                      ? "bg-amber-100 text-amber-900 border-amber-300"
                                      : "bg-indigo/10 text-indigo border border-indigo/20"
                            }`}>
                              {item.first_name[0]}{item.last_name[0]}
                            </div>
                            <div>
                              <span className="font-bold text-charcoal text-xs sm:text-sm block">
                                {item.first_name} {item.last_name}
                              </span>
                              {item.contact_phone && (
                                <span className="text-[11px] text-stone-400 font-medium">
                                  {item.contact_phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Ministry */}
                        <td className="py-3.5 px-4">
                          <span
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-2xs inline-block"
                            style={{ backgroundColor: item.ministry_color || "#2C3968" }}
                          >
                            {item.ministry_name || "General"}
                          </span>
                        </td>

                        {/* RSVP Status */}
                        <td className="py-3.5 px-4">
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                              <Check className="w-3 h-3 text-amber-700" />
                              Pre-Registered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium text-stone-400 bg-stone-50 border border-stone-200/60">
                              Walk-In
                            </span>
                          )}
                        </td>

                        {/* Attendance Status */}
                        <td className="py-3.5 px-4">
                          {isPresent ? (
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-950 border border-emerald-300 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                <span>Present</span>
                              </span>
                              {item.checked_in_at && (
                                <p className="text-[10px] text-charcoal/50 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-charcoal/40" />
                                  In: {new Date(item.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </div>
                          ) : isAbsent ? (
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-950 border border-rose-300 inline-flex items-center gap-1">
                                <UserX className="w-3 h-3 text-rose-700" />
                                <span>Absent</span>
                              </span>
                              {item.attendance_notes && (
                                <p className="text-[10px] text-rose-800 font-medium truncate max-w-xs">
                                  {item.attendance_notes.replace("[ABSENT]", "").trim()}
                                </p>
                              )}
                            </div>
                          ) : isExcused ? (
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-300 inline-flex items-center gap-1">
                                <HelpCircle className="w-3 h-3 text-amber-700" />
                                <span>Excused</span>
                              </span>
                              {item.attendance_notes && (
                                <p className="text-[10px] text-amber-800 font-medium truncate max-w-xs">
                                  {item.attendance_notes.replace("[EXCUSED]", "").trim()}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-charcoal/60">
                              Unmarked
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => isFastMode ? e.stopPropagation() : undefined}>
                          {isFastMode ? (
                            <div className="inline-flex items-center justify-end">
                              {rollCallTarget === "mark_absent" && (
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                                  Will Mark Absent / Pending
                                </span>
                              )}
                              {rollCallTarget === "default_present" && (
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  Default: Present
                                </span>
                              )}
                              {rollCallTarget === "mark_present" && (
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  Will Mark Present
                                </span>
                              )}
                              {rollCallTarget === "default_absent" && (
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                                  Default: Absent / Pending
                                </span>
                              )}
                              {rollCallTarget === "unchanged" && (
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-charcoal/40 bg-gray-100 border border-gray-200">
                                  Unchanged
                                </span>
                              )}
                            </div>
                          ) : isPresent ? (
                            <button
                              onClick={() => handleUndoAttendance(item)}
                              disabled={isChecking}
                              className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-rose-50 hover:text-rose-700 text-charcoal/70 text-xs font-bold transition-all cursor-pointer"
                              title="Undo check-in"
                            >
                              <span>Undo</span>
                            </button>
                          ) : isAbsent || isExcused ? (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => handleMarkPresent(item)}
                                disabled={isChecking}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Mark Present</span>
                              </button>
                              <button
                                onClick={() => handleUndoAttendance(item)}
                                disabled={isChecking}
                                className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-charcoal/70 text-xs font-bold transition-all cursor-pointer"
                                title="Undo mark"
                              >
                                Undo
                              </button>
                            </div>
                          ) : (
                            /* When Unmarked */
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {/* 1. Mark Present */}
                              <button
                                onClick={() => handleMarkPresent(item)}
                                disabled={isChecking}
                                className="px-3 py-1.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-black shadow-2xs hover:shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5 text-amber-300" />
                                <span>Present</span>
                              </button>

                              {/* 2. Quick Mark Absent */}
                              <button
                                onClick={() => handleQuickMarkAbsent(item)}
                                disabled={isChecking}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                                title="Quick mark as Absent"
                              >
                                <UserX className="w-3 h-3" />
                                <span>Absent</span>
                              </button>

                              {/* 3. Mark Excused with Reason */}
                              <button
                                onClick={() => handleOpenAbsentModal(item, "excused")}
                                disabled={isChecking}
                                className="px-2 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all cursor-pointer"
                                title="Mark as Excused (Sick, Out of Town, etc.)"
                              >
                                <span>Excused...</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BAR FOR BATCH ROLL CALL */}
      {isFastMode && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl bg-slate-950/95 text-white backdrop-blur-md p-3 sm:p-4 rounded-3xl shadow-2xl border border-slate-700/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 animate-in slide-in-from-bottom-6">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              fastModeType === "absent_rest_present"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : fastModeType === "present_rest_absent"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
            }`}>
              {fastModeType === "absent_rest_present" ? (
                <UserX className="w-5 h-5" />
              ) : fastModeType === "present_rest_absent" ? (
                <UserCheck className="w-5 h-5" />
              ) : (
                <CheckSquare className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>
                  {fastModeType === "absent_rest_present"
                    ? "Absence Selection Active"
                    : fastModeType === "present_rest_absent"
                      ? "Presence Selection Active"
                      : "Selective Check-In Active"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                  {batchScopeList.length} Members in Scope
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {fastModeType === "absent_rest_present" ? (
                  <>
                    <strong className="text-rose-400 font-bold">{selectedMemberIds.size} Absent</strong> • <strong className="text-emerald-400 font-bold">{Math.max(0, batchScopeList.length - selectedMemberIds.size)} Auto-Present</strong>
                  </>
                ) : fastModeType === "present_rest_absent" ? (
                  <>
                    <strong className="text-emerald-400 font-bold">{selectedMemberIds.size} Present</strong> • <strong className="text-rose-400 font-bold">{Math.max(0, batchScopeList.length - selectedMemberIds.size)} Auto-Absent</strong>
                  </>
                ) : (
                  <>
                    <strong className="text-sky-400 font-bold">{selectedMemberIds.size} Selected Present</strong>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => clearSelection()}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={() => handleApplyBatchAttendance(batchScopeList)}
              disabled={batchSubmitting || batchScopeList.length === 0}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial"
            >
              {batchSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save Attendance Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: MARK ABSENT / EXCUSED WITH REASON */}
      {absentModalMember && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 border border-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold ${
                  absentStatusType === "absent" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {absentStatusType === "absent" ? <UserX className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-sm text-charcoal">
                    Mark {absentStatusType === "absent" ? "Absent" : "Excused"} from Event
                  </h3>
                  <p className="text-[11px] text-charcoal/50">
                    {absentModalMember.first_name} {absentModalMember.last_name} • {absentModalMember.ministry_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAbsentModalMember(null)}
                className="p-1 text-charcoal/40 hover:text-charcoal cursor-pointer rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Switcher: Absent vs Excused */}
            <div className="p-1 bg-gray-100 rounded-xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAbsentStatusType("absent")}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  absentStatusType === "absent" ? "bg-white text-rose-700 shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                }`}
              >
                🔴 Mark Absent
              </button>
              <button
                type="button"
                onClick={() => setAbsentStatusType("excused")}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  absentStatusType === "excused" ? "bg-white text-amber-800 shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                }`}
              >
                🟡 Mark Excused
              </button>
            </div>

            <form onSubmit={handleSaveAbsentOrExcused} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-charcoal/80 mb-1.5">Preset Reason / Notice:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Sick / Not Feeling Well",
                    "Out of Town / Traveling",
                    "Family Event / Obligation",
                    "School / Work Conflict",
                    "Transportation / Weather",
                    "Unexcused / No Notice"
                  ].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setAbsentPresetReason(reason)}
                      className={`p-2 rounded-xl text-[11px] font-bold text-left border transition-all cursor-pointer ${
                        absentPresetReason === reason
                          ? "bg-indigo-50 border-indigo-400 text-indigo-950 ring-1 ring-indigo-400"
                          : "bg-white border-gray-200 text-charcoal/80 hover:bg-gray-50"
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal/80 mb-1">Additional Notes (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Sent notice via SMS"
                  value={absentCustomNotes}
                  onChange={(e) => setAbsentCustomNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-indigo"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAbsentModalMember(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={markingId !== null}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-black shadow-md transition-all cursor-pointer ${
                    absentStatusType === "absent" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  Confirm {absentStatusType === "absent" ? "Absent" : "Excused"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* WALK-IN REGISTRATION MODAL */}
      {isWalkInModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-stone-200 max-h-[90vh] flex flex-col animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo/10 rounded-xl text-indigo border border-indigo/20">
                  <UserPlus className="w-5 h-5 text-indigo" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-charcoal">Add Walk-In Attendee</h3>
                  <p className="text-[11px] text-stone-500 font-medium">Check in a member who was not pre-registered</p>
                </div>
              </div>
              <button
                onClick={() => setIsWalkInModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-charcoal rounded-xl hover:bg-stone-100 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search and filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search member name..."
                  value={walkInSearch}
                  onChange={(e) => setWalkInSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-ivory-light border border-charcoal/15 rounded-xl text-xs font-medium text-charcoal focus:outline-none focus:border-indigo"
                />
              </div>
              <select
                value={walkInMinistry}
                onChange={(e) => setWalkInMinistry(e.target.value)}
                className="bg-ivory-light border border-charcoal/15 text-charcoal text-xs font-semibold py-2 px-3 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="all">All Ministries</option>
                {ministries.map(m => (
                  <option key={m.id} value={String(m.id)}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* List of candidates */}
            <div className="flex-1 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-xl max-h-80">
              {loadingMembers ? (
                <div className="p-8 text-center text-stone-400 text-xs font-medium">Loading church members...</div>
              ) : walkInCandidates.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-xs font-medium">
                  No matching members found to check in.
                </div>
              ) : (
                walkInCandidates.map(m => (
                  <div
                    key={m.id}
                    className="p-3 hover:bg-ivory/60 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo/10 text-indigo font-bold text-xs flex items-center justify-center">
                        {m.first_name[0]}{m.last_name[0]}
                      </div>
                      <div>
                        <span className="font-bold text-charcoal text-xs block">
                          {m.first_name} {m.last_name}
                        </span>
                        <span className="text-[10px] text-stone-400 font-medium">
                          {m.ministry_name || "General"} {m.contact_phone ? `• ${m.contact_phone}` : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddWalkInMember(m)}
                      disabled={markingId === m.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo hover:bg-indigo-900 active:scale-[0.98] text-white font-semibold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      {markingId === m.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Check In</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => setIsWalkInModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 text-stone-600 font-bold text-xs hover:bg-stone-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

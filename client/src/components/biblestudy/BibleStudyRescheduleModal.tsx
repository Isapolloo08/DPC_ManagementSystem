import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { BibleStudyGroup, EventItem } from "../../types";
import { api } from "../../api";
import { DatePickerInput } from "../common/DatePickerInput";
import { TimePickerInput } from "../common/TimePickerInput";
import {
  CalendarClock, X, Check, AlertCircle, Sparkles,
  MapPin, Users, Clock, Building2, CheckCircle2,
  ChevronRight, Calendar, AlertTriangle, Info, HelpCircle
} from "lucide-react";

interface BibleStudyRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: BibleStudyGroup | null;
  onSaved?: () => void;
  showToast?: (msg: string, type?: "success" | "error") => void;
}

// Helper to convert time strings like "7:00 PM" or "19:00" to minutes from midnight for overlap check
const parseTimeToMinutes = (timeStr?: string | null): number | null => {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().toUpperCase();
  const match = cleaned.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];

  if (period) {
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
};

// Check if two time ranges [start1, end1] and [start2, end2] overlap
const checkTimeOverlap = (
  range1Str?: string | null,
  range2Str?: string | null
): boolean => {
  if (!range1Str || !range2Str) return false;

  const parseRange = (str: string) => {
    if (str.includes("-")) {
      const [s, e] = str.split("-");
      return { start: parseTimeToMinutes(s), end: parseTimeToMinutes(e) };
    }
    const s = parseTimeToMinutes(str);
    return { start: s, end: s !== null ? s + 90 : null }; // default 90 mins if single time
  };

  const r1 = parseRange(range1Str);
  const r2 = parseRange(range2Str);

  if (r1.start === null || r1.end === null || r2.start === null || r2.end === null) return false;
  return r1.start < r2.end && r2.start < r1.end;
};

export const BibleStudyRescheduleModal: React.FC<BibleStudyRescheduleModalProps> = ({
  isOpen,
  onClose,
  group,
  onSaved,
  showToast
}) => {
  const [allGroups, setAllGroups] = useState<BibleStudyGroup[]>([]);
  const [churchEvents, setChurchEvents] = useState<EventItem[]>([]);
  const [configuredRooms, setConfiguredRooms] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [isRescheduled, setIsRescheduled] = useState<boolean>(true);
  const [rescheduledDate, setRescheduledDate] = useState<string>("");
  const [timeStart, setTimeStart] = useState<string>("7:00 PM");
  const [timeEnd, setTimeEnd] = useState<string>("8:30 PM");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [isCustomLocation, setIsCustomLocation] = useState<boolean>(false);
  const [customLocationText, setCustomLocationText] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState<string>("");

  // Load all groups, events, and room locations
  useEffect(() => {
    if (isOpen) {
      loadContextData();
    }
  }, [isOpen]);

  // Sync initial values when group opens or configuredRooms loads
  useEffect(() => {
    if (group && isOpen) {
      setIsRescheduled(group.is_rescheduled !== undefined ? Boolean(group.is_rescheduled) : true);
      const defaultDate = group.rescheduled_date || new Date(Date.now() + 86400000).toISOString().split("T")[0];
      setRescheduledDate(defaultDate);

      let start = "7:00 PM";
      let end = "8:30 PM";
      const timeSource = group.rescheduled_time || group.meeting_time;
      if (timeSource) {
        if (timeSource.includes("-")) {
          const parts = timeSource.split("-");
          start = parts[0].trim();
          end = parts[1].trim();
        } else {
          start = timeSource.trim();
        }
      }
      setTimeStart(start);
      setTimeEnd(end);
      setRescheduleReason(group.reschedule_reason || "");

      const initialLoc = group.location || (configuredRooms.length > 0 ? configuredRooms[0] : "");
      setSelectedLocation(initialLoc);
      if (!initialLoc || configuredRooms.includes(initialLoc)) {
        setIsCustomLocation(false);
        setCustomLocationText("");
      } else {
        setIsCustomLocation(true);
        setCustomLocationText(initialLoc);
      }
    }
  }, [group, isOpen, configuredRooms]);

  const loadContextData = async () => {
    try {
      setLoadingData(true);
      const [groupsRes, eventsRes, lookupsRes] = await Promise.all([
        api.getGroups().catch(() => []),
        api.getEvents({ upcoming: true }).catch(() => []),
        api.getLookups("event_location", true).catch(() => [])
      ]);

      setAllGroups(groupsRes || []);
      setChurchEvents(eventsRes || []);

      if (lookupsRes && Array.isArray(lookupsRes) && lookupsRes.length > 0) {
        const roomNames = lookupsRes
          .filter((r: any) => r.is_active === undefined || r.is_active === 1 || r.is_active === true)
          .map((r: any) => r.name)
          .filter(Boolean);
        setConfiguredRooms(roomNames);
      } else {
        setConfiguredRooms([]);
      }
    } catch (err) {
      console.warn("Failed to load reschedule context data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  // Day of Week computed from selected date
  const targetDayInfo = useMemo(() => {
    if (!rescheduledDate) return { dayName: "Unknown", formattedDate: "" };
    try {
      const d = new Date(rescheduledDate + "T00:00:00");
      const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
      const formattedDate = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      return { dayName, formattedDate };
    } catch {
      return { dayName: "Unknown", formattedDate: rescheduledDate };
    }
  }, [rescheduledDate]);

  // Groups that meet on the target day (regular or rescheduled)
  const groupsOnTargetDay = useMemo(() => {
    if (!targetDayInfo.dayName || !group) return [];
    const targetDayLower = targetDayInfo.dayName.toLowerCase();

    return allGroups.filter((g) => {
      if (g.id === group.id) return false; // exclude self

      // Case 1: Another group is explicitly rescheduled to this exact date
      if (g.is_rescheduled && g.rescheduled_date === rescheduledDate) {
        return true;
      }
      // Case 2: Another group has this weekday as regular meeting day (and not rescheduled away)
      if (!g.is_rescheduled && g.meeting_day && g.meeting_day.toLowerCase() === targetDayLower) {
        return true;
      }
      return false;
    });
  }, [allGroups, group, targetDayInfo.dayName, rescheduledDate]);

  // Events occurring on the target date
  const eventsOnTargetDay = useMemo(() => {
    if (!rescheduledDate) return [];
    return churchEvents.filter((ev) => {
      const eventDate = ev.start_time ? ev.start_time.split("T")[0] : "";
      return eventDate === rescheduledDate;
    });
  }, [churchEvents, rescheduledDate]);

  // Target meeting time combined
  const targetMeetingTimeCombined = useMemo(() => {
    return timeEnd ? `${timeStart} - ${timeEnd}` : timeStart;
  }, [timeStart, timeEnd]);

  const activeTargetLocation = isCustomLocation ? customLocationText.trim() : selectedLocation;

  // Compute Room Statuses (Available, Conflict, Booked at other time)
  const roomOccupancyMap = useMemo(() => {
    const map = new Map<
      string,
      {
        room: string;
        isAvailable: boolean;
        hasTimeOverlap: boolean;
        occupiedBy: { name: string; type: "group" | "event"; time: string; leader?: string }[];
      }
    >();

    // Initialize all rooms
    configuredRooms.forEach((r) => {
      map.set(r, {
        room: r,
        isAvailable: true,
        hasTimeOverlap: false,
        occupiedBy: []
      });
    });

    // Check small groups
    groupsOnTargetDay.forEach((g) => {
      const gLoc = (g.location || "").trim();
      const gTime = g.is_rescheduled && g.rescheduled_time ? g.rescheduled_time : g.meeting_time;

      if (gLoc && map.has(gLoc)) {
        const entry = map.get(gLoc)!;
        const overlaps = checkTimeOverlap(targetMeetingTimeCombined, gTime);
        entry.occupiedBy.push({
          name: g.name,
          type: "group",
          time: gTime || "Scheduled Time",
          leader: g.leader_name
        });
        if (overlaps) {
          entry.hasTimeOverlap = true;
          entry.isAvailable = false;
        }
      }
    });

    // Check church events
    eventsOnTargetDay.forEach((ev) => {
      const evLoc = (ev.location || "").trim();
      const evTime = ev.start_time && ev.end_time ? `${ev.start_time} - ${ev.end_time}` : ev.start_time || "Event Schedule";

      if (evLoc && map.has(evLoc)) {
        const entry = map.get(evLoc)!;
        const overlaps = checkTimeOverlap(targetMeetingTimeCombined, evTime);
        entry.occupiedBy.push({
          name: ev.title,
          type: "event",
          time: evTime
        });
        if (overlaps) {
          entry.hasTimeOverlap = true;
          entry.isAvailable = false;
        }
      }
    });

    return map;
  }, [configuredRooms, groupsOnTargetDay, eventsOnTargetDay, targetMeetingTimeCombined]);

  // Detect conflict on currently selected location
  const currentSelectedRoomConflict = useMemo(() => {
    if (!activeTargetLocation) return null;
    const roomInfo = roomOccupancyMap.get(activeTargetLocation);
    if (roomInfo && roomInfo.hasTimeOverlap && roomInfo.occupiedBy.length > 0) {
      return roomInfo.occupiedBy[0];
    }
    return null;
  }, [roomOccupancyMap, activeTargetLocation]);

  const handleSave = async (e?: React.FormEvent, forceRevert = false) => {
    if (e) e.preventDefault();
    if (!group) return;

    const targetIsRescheduled = forceRevert ? false : isRescheduled;

    if (targetIsRescheduled && !rescheduledDate) {
      if (showToast) showToast("Please choose a rescheduled meeting date.", "error");
      return;
    }

    try {
      setIsSaving(true);
      await api.rescheduleGroup(group.id, {
        is_rescheduled: targetIsRescheduled,
        rescheduled_date: targetIsRescheduled ? rescheduledDate : null,
        rescheduled_time: targetIsRescheduled ? targetMeetingTimeCombined : null,
        reschedule_reason: targetIsRescheduled ? rescheduleReason : null,
        location: targetIsRescheduled && activeTargetLocation ? activeTargetLocation : group.location
      });

      if (showToast) {
        showToast(
          targetIsRescheduled
            ? `✓ Session for "${group.name}" moved to ${targetDayInfo.formattedDate} (${targetMeetingTimeCombined})!`
            : `✓ "${group.name}" reverted back to regular weekly schedule.`,
          "success"
        );
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      if (showToast) showToast(err.message || "Failed to update reschedule schedule", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !group) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-indigo-100 space-y-5 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-500/30 text-amber-900 border border-amber-300/50 flex items-center justify-center font-bold shadow-2xs">
              <CalendarClock className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-lg text-charcoal tracking-tight">
                  Reschedule Bible Study Session
                </h3>
                {group.is_rescheduled && (
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase">
                    Currently Rescheduled
                  </span>
                )}
              </div>
              <p className="text-xs text-charcoal/60 truncate max-w-md mt-0.5">
                {group.name} • Facilitator: <span className="font-bold text-charcoal/80">{group.leader_name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-charcoal/40 hover:text-charcoal hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Regular Schedule Reference Banner */}
        <div className="p-3.5 bg-gradient-to-r from-amber-50/70 via-ivory to-indigo-50/50 rounded-2xl border border-amber-200/70 text-xs flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-amber-900/60 uppercase tracking-wider block">
              Regular Schedule
            </span>
            <div className="font-extrabold text-charcoal flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              <span>Every {group.meeting_day} at {group.meeting_time}</span>
            </div>
          </div>
          <div className="text-left sm:text-right space-y-0.5">
            <span className="text-[10px] font-black text-amber-900/60 uppercase tracking-wider block">
              Current Location
            </span>
            <div className="font-extrabold text-charcoal flex items-center sm:justify-end gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-700" />
              <span>{group.location || "Fellowship Hall"}</span>
            </div>
          </div>
        </div>

        <form onSubmit={(e) => handleSave(e, false)} className="space-y-5 text-xs">
          {/* 1. Reschedule Status Selector */}
          <div>
            <label className="block font-black text-charcoal uppercase tracking-wider text-[11px] mb-2">
              Reschedule Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div
                onClick={() => setIsRescheduled(true)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${isRescheduled
                  ? "bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/40 text-amber-950 font-bold shadow-2xs"
                  : "bg-white border-gray-200 text-charcoal/70 hover:border-gray-300"
                  }`}
              >
                <div className="w-5 h-5 rounded-full border-2 border-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                  {isRescheduled && <div className="w-2.5 h-2.5 rounded-full bg-amber-600"></div>}
                </div>
                <div>
                  <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <span>⚠️ Reschedule Next Session</span>
                  </div>
                  <div className="text-[11px] text-amber-800/80 font-medium mt-0.5 leading-relaxed">
                    Move next meeting to a new date, time slot, and check room availability.
                  </div>
                </div>
              </div>

              <div
                onClick={() => setIsRescheduled(false)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${!isRescheduled
                  ? "bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/40 text-emerald-950 font-bold shadow-2xs"
                  : "bg-white border-gray-200 text-charcoal/70 hover:border-gray-300"
                  }`}
              >
                <div className="w-5 h-5 rounded-full border-2 border-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  {!isRescheduled && <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>}
                </div>
                <div>
                  <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <span>✓ Follow Regular Weekly Schedule</span>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Conditional Reschedule Controls */}
          {isRescheduled && (
            <div className="space-y-4">
              {/* Date & Time Pickers */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span className="font-black text-charcoal text-xs">Pick Target Reschedule Date & Time</span>
                  </div>
                  <span className="text-[11px] font-extrabold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                    Day: {targetDayInfo.dayName}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <DatePickerInput
                      label="New Session Date *"
                      required={isRescheduled}
                      value={rescheduledDate}
                      onChange={(val) => setRescheduledDate(val)}
                      placeholder="Select new meeting date"
                      amberTheme
                    />
                  </div>

                  <div>
                    <TimePickerInput
                      label="New Start Time *"
                      value={timeStart}
                      onChange={(val) => setTimeStart(val)}
                      placeholder="e.g. 6:30 PM"
                      required
                    />
                  </div>

                  <div>
                    <TimePickerInput
                      label="New End Time"
                      value={timeEnd}
                      onChange={(val) => setTimeEnd(val)}
                      placeholder="e.g. 8:00 PM"
                    />
                  </div>
                </div>
              </div>

              {/* 2. CHURCH ROOMS & VENUE AVAILABILITY INSPECTOR */}
              <div className="p-4 bg-white rounded-2xl border border-indigo-100 shadow-2xs space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo" />
                    <span className="font-black text-charcoal text-xs">Church Rooms Availability on {targetDayInfo.dayName}</span>
                  </div>
                  <span className="text-[10px] text-charcoal/60 font-bold">
                    Click an open room to select
                  </span>
                </div>

                {/* Conflict Alert if current selected room is occupied */}
                {currentSelectedRoomConflict ? (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start gap-2.5 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <strong className="font-bold block">
                        Room Overlap Conflict: "{activeTargetLocation}" is currently in use!
                      </strong>
                      <span className="text-rose-900 text-[11px]">
                        Occupied by{" "}
                        <strong>{currentSelectedRoomConflict.name}</strong> ({currentSelectedRoomConflict.time}
                        {currentSelectedRoomConflict.leader ? ` • Leader: ${currentSelectedRoomConflict.leader}` : ""}). Please select an open room below.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Selected Room: <strong>{activeTargetLocation || "Fellowship Hall"}</strong> is clear with 0 conflicts!</span>
                    </div>
                    <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full uppercase">
                      Ready
                    </span>
                  </div>
                )}

                {/* Available Rooms Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {configuredRooms.length === 0 ? (
                    <div className="col-span-full py-6 px-4 rounded-xl bg-gray-50 border border-gray-200 text-charcoal/60 text-center text-xs space-y-1">
                      <p className="font-bold">No meeting rooms found in database</p>
                      <p className="text-[11px]">Add rooms in Settings &gt; System Lookups or use a custom off-site venue below.</p>
                    </div>
                  ) : (
                    configuredRooms.map((roomName) => {
                      const info = roomOccupancyMap.get(roomName);
                      const isSelected = activeTargetLocation === roomName && !isCustomLocation;
                      const isConflict = info && !info.isAvailable;
                      const isBookedOtherTime = info && info.isAvailable && info.occupiedBy.length > 0;

                      return (
                        <button
                          key={roomName}
                          type="button"
                          onClick={() => {
                            setSelectedLocation(roomName);
                            setIsCustomLocation(false);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1 ${isSelected
                            ? "bg-indigo-50 border-indigo ring-2 ring-indigo/40 shadow-xs"
                            : isConflict
                              ? "bg-rose-50/50 border-rose-200 hover:bg-rose-50"
                              : "bg-gray-50/60 hover:bg-white border-gray-200 hover:border-indigo-300"
                            }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-charcoal truncate">{roomName}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo shrink-0" />}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isConflict ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                In Use ({info?.occupiedBy[0]?.time})
                              </span>
                            ) : isBookedOtherTime ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Free now (Booked {info?.occupiedBy[0]?.time})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                🟢 Available / Open
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Custom Location Toggle */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsCustomLocation(!isCustomLocation)}
                      className="text-xs text-indigo font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>{isCustomLocation ? "← Choose from Church Rooms List" : "+ Use Custom Off-Site / Online Venue"}</span>
                    </button>
                  </div>

                  {isCustomLocation && (
                    <div className="mt-2 animate-in fade-in">
                      <input
                        type="text"
                        placeholder="e.g. Bro John's Residence (Daet), Google Meet, Cafe Rooftop"
                        value={customLocationText}
                        onChange={(e) => setCustomLocationText(e.target.value)}
                        className="w-full bg-ivory-light p-2.5 rounded-xl border border-indigo-200 focus:outline-none focus:border-indigo text-xs font-medium"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 3. WHO IS MEETING ON THIS DAY (Sino ang mga nag-bi-bible study sa araw na ito) */}
              <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-charcoal/70" />
                    <span className="font-black text-charcoal text-xs">
                      Groups Scheduled on {targetDayInfo.dayName} ({groupsOnTargetDay.length})
                    </span>
                  </div>
                  <span className="text-[10px] text-charcoal/50 font-bold">
                    Check if your flock can coordinate or join
                  </span>
                </div>

                {groupsOnTargetDay.length > 0 ? (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {groupsOnTargetDay.map((g) => {
                      const displayTime = g.is_rescheduled && g.rescheduled_time ? g.rescheduled_time : g.meeting_time;
                      return (
                        <div
                          key={g.id}
                          className="p-2.5 bg-white rounded-xl border border-gray-200/80 text-xs flex items-center justify-between gap-2 flex-wrap shadow-2xs hover:border-indigo-200 transition-colors"
                        >
                          <div className="space-y-0.5 min-w-[180px]">
                            <div className="font-bold text-charcoal flex items-center gap-1.5">
                              <span className="truncate">{g.name}</span>
                              {g.is_rescheduled ? (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded uppercase">
                                  Rescheduled
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[10px] text-charcoal/60">
                              Leader: <span className="font-semibold text-charcoal">{g.leader_name}</span> • {g.category || "General"}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-right">
                            <div className="space-y-0.5">
                              <div className="font-extrabold text-indigo text-[11px] flex items-center gap-1">
                                <Clock className="w-3 h-3 text-indigo-500" />
                                <span>{displayTime}</span>
                              </div>
                              <div className="text-[10px] text-charcoal/60 flex items-center gap-1 font-medium">
                                <MapPin className="w-3 h-3 text-charcoal/40" />
                                <span>{g.location || "Room TBD"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-xl border border-dashed border-gray-300 text-center text-xs text-charcoal/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    <span>No other Bible Study groups scheduled on <strong>{targetDayInfo.dayName}</strong> — open schedule availability!</span>
                  </div>
                )}
              </div>

              {/* 4. Reason / Notice for Disciples */}
              <div>
                <label className="block font-bold text-charcoal mb-1">
                  Reason & Announcement Notice for Disciples *
                </label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {[
                    "Typhoon / Severe Weather",
                    "Leader Ministry Travel",
                    "Church-Wide Conference",
                    "Room / Venue Conflict",
                    "Members Agreement & Request"
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setRescheduleReason(chip)}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-amber-100 hover:text-amber-950 border border-gray-200 text-[10px] font-bold text-charcoal/70 transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  required={isRescheduled}
                  placeholder="e.g. 'Naurong po ang ating small group meeting sa Huwebes dahil may church leadership event. Kitakits po tayo sa Room 102 ng 6:30 PM!'..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full bg-white p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-gray-100 font-bold text-xs text-charcoal hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
              {group.is_rescheduled ? (
                <button
                  type="button"
                  onClick={() => handleSave(undefined, true)}
                  disabled={isSaving}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer"
                  title="Clear reschedule and revert to regular weekly schedule"
                >
                  Revert to Regular Schedule
                </button>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-slate-950" />
              <span>
                {isSaving
                  ? "Saving..."
                  : isRescheduled
                    ? "Save Rescheduled Session"
                    : "Save Regular Schedule"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

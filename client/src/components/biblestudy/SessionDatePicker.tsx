/**
 * SessionDatePicker.tsx
 * Accessible, session-based meeting date picker for Small Group Weekly Roll-Call Attendance.
 * Features:
 * - Compact session row ("Thu, Sep 10 · Missing" with status badge and Change chevron-right button)
 * - Attached side flyout panel on desktop (w-80) / bottom sheet on mobile (< md)
 * - Missing (N) | All segmented control
 * - Month grouping with sticky headers
 * - Latest / Logged / Missing badges with #2B3467 navy selected state
 * - Pagination ("Show older sessions")
 * - Pinned "+ Add special session" footer
 * - Keyboard navigation (role="listbox", ArrowUp/Down, Enter/Space, Escape)
 * - Focus return to Change button on close
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar, CheckCircle2, Clock, Sparkles, ArrowLeft,
  ChevronLeft, ChevronRight, Plus, Info, X
} from "lucide-react";
import { DatePickerInput } from "../common/DatePickerInput";

export interface SessionOptionItem {
  date: string; // YYYY-MM-DD
  formattedDate: string; // "Thu, Sep 17"
  isLatest: boolean;
  isLogged?: boolean;
  loggedSession?: {
    id?: number;
    topic_title?: string;
    chapter?: string;
    notes?: string;
    present_count?: number;
    absent_count?: number;
    is_special?: boolean;
    special_reason?: string;
    attendees?: Array<{ member_id: number; name: string }>;
  };
}

export interface SessionDatePickerProps {
  sessions: SessionOptionItem[];
  value: string; // selected YYYY-MM-DD
  onChange: (date: string, session?: SessionOptionItem) => void;
  isSpecial: boolean;
  specialReason: string;
  onSpecialChange: (isSpecial: boolean, date: string, reason: string) => void;
  groupScheduleText?: string;
  disabled?: boolean;
  onLoadOlder?: () => void;
  isFlyoutOpen?: boolean;
  onFlyoutOpenChange?: (isOpen: boolean) => void;
  onBeforeChangeSession?: (targetSession: SessionOptionItem) => boolean | Promise<boolean>;
  changeButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Compact Session Row for the Main Modal Body
 */
export const SessionDatePickerCompactRow: React.FC<{
  sessions: SessionOptionItem[];
  value: string;
  isSpecial: boolean;
  specialReason: string;
  onSpecialChange: (isSpecial: boolean, date: string, reason: string) => void;
  groupScheduleText?: string;
  disabled?: boolean;
  isFlyoutOpen: boolean;
  onToggleFlyout: () => void;
  changeButtonRef?: React.RefObject<HTMLButtonElement | null>;
}> = ({
  sessions,
  value,
  isSpecial,
  specialReason,
  onSpecialChange,
  groupScheduleText,
  disabled = false,
  isFlyoutOpen,
  onToggleFlyout,
  changeButtonRef,
}) => {
    const [specialDate, setSpecialDate] = useState<string>(() => {
      return value || new Date().toISOString().split("T")[0];
    });

    const selectedSession = useMemo(() => {
      return sessions.find((s) => s.date === value);
    }, [sessions, value]);

    // Special / Rescheduled Session Inline Banner
    if (isSpecial) {
      return (
        <div className="space-y-3 p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200 animate-in fade-in text-xs shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-black text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Special / Rescheduled Session</span>
            </div>
            <button
              type="button"
              onClick={() => onSpecialChange(false, sessions[0]?.date || "", "")}
              className="text-[11px] font-bold text-indigo hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to regular schedule</span>
            </button>
          </div>

          <p className="text-[11px] text-amber-900/80">
            Record attendance for make-up meetings, holiday shift schedules, or special fellowship gatherings.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="block font-bold text-charcoal/80 mb-1">Session Date *</label>
              <DatePickerInput
                value={value || specialDate}
                onChange={(val) => {
                  setSpecialDate(val);
                  onSpecialChange(true, val, specialReason);
                }}
                placeholder="Select date"
              />
            </div>

            <div>
              <label className="block font-bold text-charcoal/80 mb-1">
                Reason for Special Session *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Makeup class, Holiday shift"
                value={specialReason}
                onChange={(e) => onSpecialChange(true, value || specialDate, e.target.value)}
                className="w-full bg-white px-3 py-2 rounded-xl border border-amber-300 text-charcoal font-semibold text-xs focus:outline-none focus:border-indigo shadow-2xs"
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1 text-xs shrink-0">
        <div className="flex items-center justify-between">
          <label className="block font-black text-charcoal">
            Meeting Session Date
          </label>
          {groupScheduleText && (
            <span className="text-[10px] text-charcoal/50 font-semibold truncate max-w-[220px]">
              {groupScheduleText}
            </span>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center space-y-1.5">
            <Info className="w-4 h-4 text-charcoal/40 mx-auto" />
            <p className="font-bold text-charcoal/80 text-[11px]">No weekly schedule configured</p>
            <button
              type="button"
              onClick={() => onSpecialChange(true, new Date().toISOString().split("T")[0], "Special Meeting")}
              className="inline-flex items-center gap-1 px-3 py-1 bg-indigo text-white rounded-xl font-bold text-xs shadow-2xs hover:bg-indigo-700 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add special session</span>
            </button>
          </div>
        ) : (
          <div
            className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2 shadow-2xs ${isFlyoutOpen
              ? "bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo/10"
              : "bg-ivory-light border-gray-200 hover:border-indigo-200 hover:bg-white"
              }`}
          >
            {/* Left: Calendar Icon + Date / Status */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                <Calendar className="w-4 h-4" />
              </div>

              <div className="truncate">
                <div className="font-black text-xs text-charcoal flex items-center gap-1.5">
                  <span>{selectedSession?.formattedDate || value}</span>
                  {selectedSession?.isLatest && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-indigo-100 text-indigo-900">
                      Latest
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-charcoal/55 font-medium truncate">
                  {selectedSession?.isLogged
                    ? `✓ Attendance Logged${selectedSession.loggedSession?.chapter ? ` (${selectedSession.loggedSession.chapter})` : ""}`
                    : "⚠️ Missing attendance record"}
                </div>
              </div>
            </div>

            {/* Right: Status Badge + Change Button */}
            <div className="flex items-center gap-2 shrink-0">
              {selectedSession?.isLogged ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span>Logged</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-900 border border-amber-200">
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span>Missing</span>
                </span>
              )}

              <button
                ref={changeButtonRef as any}
                type="button"
                disabled={disabled}
                aria-expanded={isFlyoutOpen}
                aria-controls="session-flyout-panel"
                aria-label="Change session meeting date"
                onClick={onToggleFlyout}
                className="flex items-center gap-1 text-[11px] font-black text-indigo bg-white px-2.5 py-1.5 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 shadow-2xs cursor-pointer active:scale-95 transition-all"
              >
                <span>Change</span>
                <ChevronRight
                  className={`w-3.5 h-3.5 text-indigo transition-transform duration-200 ${isFlyoutOpen ? "rotate-90 md:rotate-0" : ""
                    }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : true
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isDesktop;
};
/**
 * Attached Side Flyout Panel (Desktop) / Bottom Sheet (Mobile)
 */
export const SessionFlyoutPanel: React.FC<{

  sessions: SessionOptionItem[];
  value: string;
  onSelect: (session: SessionOptionItem) => void;
  onClose: () => void;
  onSpecialClick: () => void;
  groupScheduleText?: string;
  onLoadOlder?: () => void;
}> = ({
  sessions,
  value,
  onSelect,
  onClose,
  onSpecialClick,
  groupScheduleText,
  onLoadOlder,
}) => {
    const missingCount = useMemo(() => {
      return sessions.filter((s) => !s.isLogged).length;
    }, [sessions]);
    const isDesktop = useIsDesktop();
    // Tab filter: "missing" | "all"
    const [filterTab, setFilterTab] = useState<"missing" | "all">(() => {
      return missingCount > 0 ? "missing" : "all";
    });

    // Filter sessions by missing/all
    const filteredSessions = useMemo(() => {
      if (filterTab === "missing") {
        return sessions.filter((s) => !s.isLogged);
      }
      return sessions;
    }, [sessions, filterTab]);

    // Compute available months with counts
    const availableMonths = useMemo(() => {
      const monthMap = new Map<string, { key: string; label: string; count: number; missingCount: number }>();
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];

      filteredSessions.forEach((s) => {
        const [y, m] = s.date.split("-");
        const monthIdx = parseInt(m, 10) - 1;
        const key = `${y}-${m}`;
        const label = `${monthNames[monthIdx] || m} ${y}`;

        if (!monthMap.has(key)) {
          monthMap.set(key, { key, label, count: 0, missingCount: 0 });
        }
        const current = monthMap.get(key)!;
        current.count += 1;
        if (!s.isLogged) current.missingCount += 1;
      });

      return Array.from(monthMap.values());
    }, [filteredSessions]);

    // Selected month filter ("all" or "YYYY-MM")
    const [selectedMonth, setSelectedMonth] = useState<string>("all");

    // Reset selected month if it is no longer available in the active tab filter
    useEffect(() => {
      if (selectedMonth !== "all" && !availableMonths.some((m) => m.key === selectedMonth)) {
        setSelectedMonth("all");
      }
    }, [availableMonths, filterTab, isDesktop]);

    // Filter sessions by selected month
    const monthFilteredSessions = useMemo(() => {
      if (selectedMonth === "all") {
        return filteredSessions;
      }
      return filteredSessions.filter((s) => s.date.startsWith(selectedMonth));
    }, [filteredSessions, selectedMonth]);

    // Limit of sessions displayed in list
    const [visibleLimit, setVisibleLimit] = useState(12);

    const listboxRef = useRef<HTMLDivElement>(null);
    const monthScrollRef = useRef<HTMLDivElement>(null);

    // Month Scroll / Drag State
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeftPos = useRef(0);
    const [isDragActive, setIsDragActive] = useState(false);
    const dragDistance = useRef(0);

    // Update left/right scroll buttons
    const updateScrollButtons = () => {
      const el = monthScrollRef.current;
      if (el) {
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScroll = Math.max(0, scrollWidth - clientWidth);
        setCanScrollLeft(scrollLeft > 2);
        setCanScrollRight(scrollLeft < maxScroll - 2);
      }
    };

    useEffect(() => {
      updateScrollButtons();
      const timer1 = setTimeout(updateScrollButtons, 50);
      const timer2 = setTimeout(updateScrollButtons, 200);
      const el = monthScrollRef.current;
      if (el) {
        el.addEventListener("scroll", updateScrollButtons, { passive: true });
        window.addEventListener("resize", updateScrollButtons);

        if (window.ResizeObserver) {
          const ro = new ResizeObserver(updateScrollButtons);
          ro.observe(el);
          return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            el.removeEventListener("scroll", updateScrollButtons);
            window.removeEventListener("resize", updateScrollButtons);
            ro.disconnect();
          };
        }
      }
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        if (el) el.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", updateScrollButtons);
      };
    }, [availableMonths, filterTab]);

    const slideMonths = (direction: "left" | "right") => {
      const el = monthScrollRef.current;
      if (!el) return;

      const amount = Math.max(120, Math.round(el.clientWidth * 0.7));
      el.scrollBy({
        left: direction === "right" ? amount : -amount,
        behavior: "smooth",
      });
    };

    // Wheel to horizontal scroll
    const handleMonthWheel = (e: React.WheelEvent) => {
      const el = monthScrollRef.current;
      if (!el) return;
      if (e.deltaY !== 0 || e.deltaX !== 0) {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        el.scrollLeft += delta;
        updateScrollButtons();
      }
    };

    // Month Drag Handlers (React native events)
    const [hasDragged, setHasDragged] = useState(false);

    const handleMouseDown = (e: React.MouseEvent) => {
      if (!monthScrollRef.current || e.button !== 0) return;
      isDragging.current = true;
      setIsDragActive(true);
      setHasDragged(false);
      startX.current = e.pageX - monthScrollRef.current.offsetLeft;
      scrollLeftPos.current = monthScrollRef.current.scrollLeft;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging.current || !monthScrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - monthScrollRef.current.offsetLeft;
      const walk = (x - startX.current) * 1.5;
      if (Math.abs(walk) > 4) {
        setHasDragged(true);
      }
      monthScrollRef.current.scrollLeft = scrollLeftPos.current - walk;
      updateScrollButtons();
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      setIsDragActive(false);
      setTimeout(() => setHasDragged(false), 50);
    };

    const visibleSessions = useMemo(() => {
      return monthFilteredSessions.slice(0, visibleLimit);
    }, [monthFilteredSessions, visibleLimit]);

    const hasMore = monthFilteredSessions.length > visibleLimit;

    // Group by month
    const groupedSessions = useMemo(() => {
      const groups: { monthYear: string; items: SessionOptionItem[] }[] = [];
      const groupMap = new Map<string, SessionOptionItem[]>();
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      visibleSessions.forEach((s) => {
        const [y, m] = s.date.split("-");
        const monthIdx = parseInt(m, 10) - 1;
        const key = `${monthNames[monthIdx] || m} ${y}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, []);
          groups.push({ monthYear: key, items: groupMap.get(key)! });
        }
        groupMap.get(key)!.push(s);
      });

      return groups;
    }, [visibleSessions]);

    // Keyboard navigation for role="listbox"
    const handleListKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = visibleSessions.findIndex((s) => s.date === value);
        if (currentIndex === -1) {
          if (visibleSessions.length > 0) {
            onSelect(visibleSessions[0]);
          }
          return;
        }

        if (e.key === "ArrowDown") {
          const nextIdx = Math.min(visibleSessions.length - 1, currentIndex + 1);
          onSelect(visibleSessions[nextIdx]);
        } else {
          const prevIdx = Math.max(0, currentIndex - 1);
          onSelect(visibleSessions[prevIdx]);
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const current = visibleSessions.find((s) => s.date === value);
        if (current) {
          onSelect(current);
        }
      }
    };

    const renderSessionItem = (session: SessionOptionItem) => {
      const isSelected = value === session.date;

      return (
        <div
          key={session.date}
          role="option"
          aria-selected={isSelected}
          tabIndex={0}
          onClick={() => onSelect(session)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(session);
            }
          }}
          className={`p-2.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 select-none outline-none focus:ring-2 focus:ring-indigo/30 ${isSelected
            ? "bg-[#2B3467] text-white border-[#2B3467] shadow-xs scale-[1.01]"
            : "bg-white border-gray-200 text-charcoal hover:border-indigo-300 hover:bg-indigo-50/30"
            }`}
        >
          {/* Left: Radio & Date Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected
                ? "border-amber-400 bg-amber-400"
                : "border-gray-300 bg-white"
                }`}
            >
              {isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#2B3467]" />
              )}
            </div>

            <div className="truncate">
              <div className="font-black text-xs flex items-center gap-1.5">
                <span>{session.formattedDate}</span>
                {session.loggedSession?.chapter && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded truncate ${isSelected
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 text-charcoal/70"
                      }`}
                  >
                    {session.loggedSession.chapter}
                  </span>
                )}
              </div>
              {session.loggedSession?.notes && (
                <p
                  className={`text-[10px] truncate max-w-[140px] ${isSelected ? "text-white/70" : "text-charcoal/50"
                    }`}
                >
                  "{session.loggedSession.notes}"
                </p>
              )}
            </div>
          </div>

          {/* Right: Badges */}
          <div className="flex items-center gap-1 shrink-0">
            {session.isLatest && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${isSelected
                  ? "bg-amber-400 text-slate-900 font-extrabold shadow-2xs"
                  : "bg-indigo-100 text-indigo-950 border border-indigo-200"
                  }`}
              >
                Latest
              </span>
            )}

            {session.isLogged ? (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${isSelected
                  ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/40"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
              >
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                <span>Logged</span>
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${isSelected
                  ? "bg-amber-400/30 text-amber-200 border border-amber-400/40"
                  : "bg-amber-50 text-amber-900 border border-amber-200"
                  }`}
              >
                <Clock className="w-2.5 h-2.5 text-amber-500" />
                <span>Missing</span>
              </span>
            )}
          </div>
        </div>
      );
    };

    const panelContent = (
      <div className="flex flex-col h-full min-h-0 text-xs bg-white">
        {/* 1. Header with Schedule Label & Close Button */}
        <div className="p-4 border-b border-gray-100 flex items-start justify-between shrink-0 bg-gray-50/50">
          <div>
            <h4 className="font-black text-charcoal text-xs">Select Meeting Session</h4>
            <p className="text-[10px] text-charcoal/60 font-semibold truncate max-w-[210px]">
              {groupScheduleText || "Weekly Session Schedule"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close session flyout"
            className="p-1 text-charcoal/40 hover:text-charcoal hover:bg-gray-200/60 rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Segmented Control: Missing (N) | All */}
        <div className="px-4 pt-3 pb-1.5 shrink-0 space-y-2">
          <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setFilterTab("missing");
                setVisibleLimit(6);
              }}
              className={`py-1 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center ${filterTab === "missing"
                ? "bg-amber-400 text-amber-950 shadow-2xs font-extrabold"
                : "text-charcoal/60 hover:text-charcoal"
                }`}
            >
              Missing ({missingCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab("all");
                setVisibleLimit(6);
              }}
              className={`py-1 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center ${filterTab === "all"
                ? "bg-white text-charcoal shadow-2xs font-extrabold"
                : "text-charcoal/60 hover:text-charcoal"
                }`}
            >
              All ({sessions.length})
            </button>
          </div>

          {/* 2.1. Month Filter Pills with Drag & Slide Buttons */}
          {availableMonths.length > 1 && (
            <div className="flex items-center gap-1.5 w-full">
              {/* Left Slide Button */}
              <button
                type="button"
                onClick={() => slideMonths("left")}
                aria-label="Slide months left"
                className={`p-1.5 rounded-xl border transition-all cursor-pointer shrink-0 active:scale-90 ${canScrollLeft
                  ? "bg-white text-indigo border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 shadow-2xs"
                  : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 opacity-60"
                  }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Drag & Scroll Container */}
              <div
                ref={monthScrollRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleMonthWheel}
                onDragStart={(e) => e.preventDefault()}
                className={`flex items-center gap-1 overflow-x-auto py-0.5 text-[10px] select-none scrollbar-none flex-1 min-w-0 ${isDragActive ? "cursor-grabbing" : "cursor-grab"
                  }`}
                style={{ touchAction: "pan-x" }}
              >
                <button
                  type="button"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => {
                    if (!hasDragged) {
                      setSelectedMonth("all");
                      setVisibleLimit(12);
                      e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${selectedMonth === "all"
                    ? "bg-slate-900 text-white shadow-2xs font-black"
                    : "bg-gray-100 text-charcoal/70 hover:bg-gray-200/80 hover:text-charcoal"
                    }`}
                >
                  All Months
                </button>

                {availableMonths.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    onClick={(e) => {
                      if (!hasDragged) {
                        setSelectedMonth(m.key);
                        setVisibleLimit(12);
                        e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${selectedMonth === m.key
                      ? "bg-slate-900 text-white shadow-2xs font-black"
                      : "bg-gray-100 text-charcoal/70 hover:bg-gray-200/80 hover:text-charcoal"
                      }`}
                  >
                    <span>{m.label}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded-full font-bold ${selectedMonth === m.key
                        ? "bg-amber-400 text-slate-950 font-black"
                        : m.missingCount > 0
                          ? "bg-amber-100 text-amber-900"
                          : "bg-gray-200 text-charcoal/60"
                        }`}
                    >
                      {filterTab === "missing" ? m.count : m.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Right Slide Button */}
              <button
                type="button"
                onClick={() => slideMonths("right")}
                aria-label="Slide months right"
                className={`p-1.5 rounded-xl border transition-all cursor-pointer shrink-0 active:scale-90 ${canScrollRight
                  ? "bg-white text-indigo border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 shadow-2xs"
                  : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 opacity-60"
                  }`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 3. Session list grouped by month (Independently scrollable) */}
        <div
          id="session-flyout-panel"
          ref={listboxRef}
          role="listbox"
          aria-label="Available Bible Study Sessions"
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2.5 focus:outline-none scrollbar-thin"
        >
          {monthFilteredSessions.length === 0 ? (
            <div className="py-8 text-center text-charcoal/40 space-y-1.5">
              <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500" />
              <p className="font-bold text-xs text-charcoal/80">
                {filterTab === "missing" ? "No missing sessions found!" : "No sessions found!"}
              </p>
              <p className="text-[10px] text-charcoal/50 max-w-[200px] mx-auto">
                {selectedMonth !== "all" ? (
                  <button
                    type="button"
                    onClick={() => setSelectedMonth("all")}
                    className="text-indigo font-bold hover:underline cursor-pointer"
                  >
                    View all months
                  </button>
                ) : (
                  "Switch to 'All' to view, verify, or edit past session attendance."
                )}
              </p>
            </div>
          ) : (
            groupedSessions.map((group) => (
              <div key={group.monthYear} className="space-y-1.5">
                <div className="sticky top-0 z-10 bg-gray-100/95 backdrop-blur-xs px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-charcoal/60 rounded-md border border-gray-200/50 shadow-2xs">
                  {group.monthYear}
                </div>
                <div className="space-y-1.5">
                  {group.items.map((s) => renderSessionItem(s))}
                </div>
              </div>
            ))
          )}

          {/* Show older sessions button */}
          {hasMore && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setVisibleLimit((prev) => prev + 8);
                  if (onLoadOlder) onLoadOlder();
                }}
                className="w-full py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-indigo font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
              >
                Show older sessions (+{Math.min(8, monthFilteredSessions.length - visibleLimit)} more)
              </button>
            </div>
          )}
        </div>

        {/* 4. Pinned Footer: "+ Add special session" */}
        <div className="p-3 border-t border-gray-100 bg-gray-50/90 flex items-center justify-between shrink-0">
          <span className="text-charcoal/50 text-[10px] font-semibold">
            Showing {visibleSessions.length} of {monthFilteredSessions.length}
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSpecialClick();
            }}
            className="font-black text-indigo hover:text-indigo-800 text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add special session</span>
          </button>
        </div>
      </div>
    );

    return isDesktop ? (
      // Desktop attached side panel
      <div className="flex md:w-80 border-l border-indigo-100 flex-col h-full shrink-0 animate-in fade-in slide-in-from-right-4 duration-200 motion-reduce:transition-none motion-reduce:transform-none">
        {panelContent}
      </div>
    ) : (
      // Mobile bottom sheet
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div
          className="fixed inset-0 bg-charcoal/50 backdrop-blur-2xs transition-opacity duration-200 motion-reduce:transition-none"
          onClick={onClose}
        />
        <div className="relative z-10 bg-white rounded-t-3xl shadow-2xl border-t border-indigo-100 max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 motion-reduce:transition-none motion-reduce:transform-none">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-2 shrink-0" />
          <div className="flex-1 min-h-0 flex flex-col">{panelContent}</div>
        </div>
      </div>
    );
  }

/**
 * Unified SessionDatePicker Component
 */
export const SessionDatePicker: React.FC<SessionDatePickerProps> = ({
  sessions,
  value,
  onChange,
  isSpecial,
  specialReason,
  onSpecialChange,
  groupScheduleText,
  disabled = false,
  onLoadOlder,
  isFlyoutOpen: controlledIsOpen,
  onFlyoutOpenChange,
  onBeforeChangeSession,
  changeButtonRef: externalChangeButtonRef,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const internalRef = useRef<HTMLButtonElement | null>(null);
  const changeButtonRef = externalChangeButtonRef || internalRef;

  const isFlyoutOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setFlyoutOpen = (open: boolean) => {
    if (onFlyoutOpenChange) {
      onFlyoutOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  const handleSelectSession = async (session: SessionOptionItem) => {
    if (onBeforeChangeSession) {
      const allowed = await onBeforeChangeSession(session);
      if (!allowed) return;
    }
    onChange(session.date, session);
  };

  const handleCloseFlyout = () => {
    setFlyoutOpen(false);
    changeButtonRef.current?.focus();
  };

  return (
    <>
      <SessionDatePickerCompactRow
        sessions={sessions}
        value={value}
        isSpecial={isSpecial}
        specialReason={specialReason}
        onSpecialChange={onSpecialChange}
        groupScheduleText={groupScheduleText}
        disabled={disabled}
        isFlyoutOpen={isFlyoutOpen}
        onToggleFlyout={() => setFlyoutOpen(!isFlyoutOpen)}
        changeButtonRef={changeButtonRef}
      />

      {isFlyoutOpen && !isSpecial && (
        <SessionFlyoutPanel
          sessions={sessions}
          value={value}
          onSelect={handleSelectSession}
          onClose={handleCloseFlyout}
          onSpecialClick={() => {
            onSpecialChange(true, new Date().toISOString().split("T")[0], "");
          }}
          groupScheduleText={groupScheduleText}
          onLoadOlder={onLoadOlder}
        />
      )}
    </>
  );
};

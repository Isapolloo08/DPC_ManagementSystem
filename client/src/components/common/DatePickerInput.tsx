import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Sparkles,
  RotateCcw,
  X
} from "lucide-react";

interface DatePickerInputProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
  inputClassName?: string;
  dark?: boolean;
  amberTheme?: boolean;
  sundaysOnly?: boolean;
  allowedDaysOfWeek?: number[]; // e.g. [0] for Sunday only
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  onChange,
  placeholder = "Select date",
  required = false,
  minDate,
  maxDate,
  className = "",
  inputClassName = "",
  dark = false,
  amberTheme = false,
  sundaysOnly = false,
  allowedDaysOfWeek
}) => {
  const effectiveAllowedDays = allowedDaysOfWeek || (sundaysOnly ? [0] : null);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Parse YYYY-MM-DD or default to current date
  const parseDate = (dateStr: string) => {
    if (!dateStr) {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth(), // 0-indexed
        day: now.getDate()
      };
    }
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return {
        year: parts[0],
        month: parts[1] - 1, // 0-indexed
        day: parts[2]
      };
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate()
      };
    }
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate()
    };
  };

  const selected = value ? parseDate(value) : null;
  const initial = parseDate(value);

  const [viewYear, setViewYear] = useState<number>(initial.year);
  const [viewMonth, setViewMonth] = useState<number>(initial.month);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);

  // Sync view when value changes from outside
  useEffect(() => {
    if (value) {
      const parsed = parseDate(value);
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);

  // Compute position relative to viewport
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 320;
      const popoverHeight = 390;

      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }
      if (left < 12) left = 12;

      let top = rect.bottom + 6;
      if (window.innerHeight - rect.bottom < popoverHeight && rect.top > popoverHeight) {
        top = rect.top - popoverHeight - 6;
      }

      setCoords({ top, left });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [isOpen]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const firstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay(); // 0 = Sunday
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const formatted = `${viewYear}-${mm}-${dd}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const formatDisplay = (val: string) => {
    if (!val) return "";
    try {
      const parts = val.split("-").map(Number);
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
      }
      return val;
    } catch {
      return val;
    }
  };

  // Quick Preset Handlers
  const handleSetToday = () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    onChange(`${today.getFullYear()}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const handleSetRecentSunday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 0 : -day;
    d.setDate(d.getDate() + diff);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    onChange(`${d.getFullYear()}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const handleSetNextSunday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (7 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    onChange(`${d.getFullYear()}-${mm}-${dd}`);
    setIsOpen(false);
  };

  // Generate years list (from 1920 to current year + 10)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1920 + 15 }, (_, i) => currentYear + 10 - i);

  // Calendar Grid Cells
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDayIndex = firstDayOfMonth(viewYear, viewMonth);
  const prevMonthTotalDays = daysInMonth(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1);

  const today = new Date();
  const isCurrentMonthToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block font-bold text-xs text-charcoal/70 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Trigger Input */}
      <div ref={triggerRef} className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full p-2.5 pl-8 pr-7 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs font-bold h-[41px] ${
            dark
              ? "bg-indigo-950/80 text-white border-white/10 hover:border-white/20"
              : amberTheme
              ? "bg-white text-charcoal border-amber-300 hover:border-amber-400"
              : isOpen
              ? "border-indigo ring-2 ring-indigo-100 bg-white text-charcoal"
              : "bg-ivory-light text-charcoal border-gray-200 hover:border-gray-300"
          } ${inputClassName}`}
        >
          <CalendarIcon
            className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
              dark ? "text-amber-400" : amberTheme ? "text-amber-600" : "text-indigo-600"
            }`}
          />
          <span className={`truncate ${value ? "font-bold" : "opacity-40 font-normal"}`}>
            {value ? formatDisplay(value) : placeholder}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-indigo-600" : "opacity-40"
            }`}
          />
        </div>
      </div>

      {/* Portal Popover Calendar */}
      {isOpen && coords && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => {
              setIsOpen(false);
              setIsYearPickerOpen(false);
            }}
          />

          {/* Calendar Popover */}
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999
            }}
            className="w-80 bg-white rounded-2xl shadow-2xl border border-indigo-100 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header: Month / Year Navigation */}
            <div className="flex items-center justify-between p-2 bg-gradient-to-r from-indigo-900 via-indigo to-indigo-800 text-white rounded-xl shadow-xs">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded-lg hover:bg-white/20 text-indigo-200 hover:text-white transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight">
                  {monthNames[viewMonth]}
                </span>
                
                {/* Year Dropdown Trigger */}
                <button
                  type="button"
                  onClick={() => setIsYearPickerOpen(!isYearPickerOpen)}
                  className="px-2 py-0.5 rounded-md bg-white/15 hover:bg-white/25 text-amber-300 hover:text-amber-200 font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                >
                  <span>{viewYear}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isYearPickerOpen ? "rotate-180" : ""}`} />
                </button>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded-lg hover:bg-white/20 text-indigo-200 hover:text-white transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Year Selector Grid (when open) */}
            {isYearPickerOpen ? (
              <div className="h-56 overflow-y-auto pr-1 grid grid-cols-4 gap-1 p-1 bg-gray-50 rounded-xl border border-gray-100">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewYear(y);
                      setIsYearPickerOpen(false);
                    }}
                    className={`py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                      y === viewYear
                        ? "bg-indigo text-white font-black shadow-xs"
                        : "text-charcoal/80 hover:bg-indigo-50 hover:text-indigo"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {/* Days of Week Header */}
                <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-wider text-charcoal/40">
                  {sundaysOnly ? (
                    <>
                      <span className="text-rose-600 font-extrabold bg-rose-50/80 rounded-md py-0.5 border border-rose-200">Su</span>
                      <span className="text-charcoal/25 font-normal">Mo</span>
                      <span className="text-charcoal/25 font-normal">Tu</span>
                      <span className="text-charcoal/25 font-normal">We</span>
                      <span className="text-charcoal/25 font-normal">Th</span>
                      <span className="text-charcoal/25 font-normal">Fr</span>
                      <span className="text-charcoal/25 font-normal">Sa</span>
                    </>
                  ) : (
                    <>
                      <span className="text-rose-500">Su</span>
                      <span>Mo</span>
                      <span>Tu</span>
                      <span>We</span>
                      <span>Th</span>
                      <span>Fr</span>
                      <span className="text-indigo-600">Sa</span>
                    </>
                  )}
                </div>

                {/* Days Matrix */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {/* Leading Previous Month Days */}
                  {Array.from({ length: startDayIndex }).map((_, idx) => {
                    const d = prevMonthTotalDays - startDayIndex + idx + 1;
                    return (
                      <div
                        key={`prev-${idx}`}
                        className="py-1.5 text-xs text-charcoal/20 font-medium select-none"
                      >
                        {d}
                      </div>
                    );
                  })}

                  {/* Current Month Days */}
                  {Array.from({ length: totalDays }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const dayDate = new Date(viewYear, viewMonth, dayNum);
                    const dayOfWeek = dayDate.getDay();
                    const isAllowed = effectiveAllowedDays ? effectiveAllowedDays.includes(dayOfWeek) : true;
                    const isSelected =
                      selected &&
                      selected.year === viewYear &&
                      selected.month === viewMonth &&
                      selected.day === dayNum;

                    const isToday = isCurrentMonthToday && today.getDate() === dayNum;

                    if (!isAllowed) {
                      return (
                        <div
                          key={`day-${dayNum}`}
                          className="py-1.5 text-xs text-charcoal/20 select-none cursor-not-allowed font-normal text-center"
                          title="Only Sundays can be selected"
                        >
                          {dayNum}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={`day-${dayNum}`}
                        type="button"
                        onClick={() => handleSelectDay(dayNum)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                          isSelected
                            ? "bg-indigo text-white font-black shadow-xs ring-2 ring-indigo-200 scale-105"
                            : isToday
                            ? "bg-amber-100 text-amber-950 font-black border border-amber-300 hover:bg-amber-200"
                            : sundaysOnly
                            ? "text-indigo-950 font-black bg-indigo-50/70 hover:bg-indigo hover:text-white border border-indigo-200/70"
                            : "text-charcoal hover:bg-indigo-50 hover:text-indigo"
                        }`}
                      >
                        {dayNum}
                        {isToday && !isSelected && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Quick Presets & Shortcuts */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1 flex-wrap">
              <div className="flex items-center gap-1">
                {sundaysOnly ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSetRecentSunday}
                      className="px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-[10px] font-bold text-indigo-900 border border-indigo-200 transition-colors cursor-pointer"
                    >
                      Latest Sunday
                    </button>
                    <button
                      type="button"
                      onClick={handleSetNextSunday}
                      className="px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-[10px] font-bold text-amber-900 border border-amber-200 transition-colors cursor-pointer"
                    >
                      Next Sunday
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSetToday}
                      className="px-2 py-1 rounded-md bg-ivory-light hover:bg-indigo-50 text-[10px] font-bold text-indigo-900 border border-indigo-100 transition-colors cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={handleSetNextSunday}
                      className="px-2 py-1 rounded-md bg-ivory-light hover:bg-amber-50 text-[10px] font-bold text-amber-900 border border-amber-200 transition-colors cursor-pointer"
                    >
                      Sunday
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  className="text-[11px] font-semibold text-charcoal/40 hover:text-rose-500 px-1 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-2.5 py-1 bg-indigo hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

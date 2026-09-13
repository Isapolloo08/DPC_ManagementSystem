import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Sun,
  Moon,
  Sparkles
} from "lucide-react";

interface DateTimePickerInputProps {
  label?: string;
  value: string; // "YYYY-MM-DDTHH:mm" or ISO string
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const DateTimePickerInput: React.FC<DateTimePickerInputProps> = ({
  label,
  value,
  onChange,
  placeholder = "Select date & time",
  required = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Deterministic String-based parser for "YYYY-MM-DDTHH:mm" to avoid timezone shifts
  const parseDateTime = (dtStr: string) => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();
    let hour = 9;
    let minute = "00";
    let period: "AM" | "PM" = "AM";

    if (dtStr) {
      if (dtStr.includes("T")) {
        const [dPart, tPart] = dtStr.split("T");
        if (dPart) {
          const parts = dPart.split("-").map(Number);
          if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            year = parts[0];
            month = parts[1] - 1;
            day = parts[2];
          }
        }
        if (tPart) {
          const timeParts = tPart.split(":");
          if (timeParts.length >= 2) {
            let rawH = parseInt(timeParts[0], 10);
            let rawM = parseInt(timeParts[1], 10);
            if (!isNaN(rawH)) {
              period = rawH >= 12 ? "PM" : "AM";
              if (rawH === 0) hour = 12;
              else if (rawH > 12) hour = rawH - 12;
              else hour = rawH;
            }
            if (!isNaN(rawM)) {
              minute = String(rawM).padStart(2, "0");
            }
          }
        }
      } else {
        try {
          const d = new Date(dtStr);
          if (!isNaN(d.getTime())) {
            year = d.getFullYear();
            month = d.getMonth();
            day = d.getDate();
            let rawH = d.getHours();
            period = rawH >= 12 ? "PM" : "AM";
            if (rawH === 0) hour = 12;
            else if (rawH > 12) hour = rawH - 12;
            else hour = rawH;
            minute = String(d.getMinutes()).padStart(2, "0");
          }
        } catch {}
      }
    }

    return {
      year,
      month,
      day,
      hour: String(hour),
      minute,
      period
    };
  };

  const initial = parseDateTime(value);
  const [viewYear, setViewYear] = useState<number>(initial.year);
  const [viewMonth, setViewMonth] = useState<number>(initial.month);
  const [selectedDay, setSelectedDay] = useState<number>(initial.day);
  const [selectedHour, setSelectedHour] = useState<string>(initial.hour);
  const [selectedMinute, setSelectedMinute] = useState<string>(initial.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(initial.period);

  useEffect(() => {
    if (value) {
      const parsed = parseDateTime(value);
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      setSelectedDay(parsed.day);
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
      setSelectedPeriod(parsed.period);
    }
  }, [value]);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = Math.min(480, window.innerWidth - 24);
      const popoverHeight = 390;

      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }
      if (left < 12) left = 12;

      let top = rect.bottom + 6;
      if (window.innerHeight - rect.bottom < popoverHeight && rect.top > popoverHeight) {
        top = Math.max(12, rect.top - popoverHeight - 6);
      }

      setCoords({ top, left });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(prev => !prev);
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

  const emitChange = (y: number, m: number, d: number, hStr: string, minStr: string, p: "AM" | "PM") => {
    let h = parseInt(hStr, 10);
    if (p === "PM" && h < 12) h += 12;
    if (p === "AM" && h === 12) h = 0;

    const yyyy = String(y);
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const hh = String(h).padStart(2, "0");
    const formatted = `${yyyy}-${mm}-${dd}T${hh}:${minStr}`;
    onChange(formatted);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const firstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
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
    setSelectedDay(day);
    emitChange(viewYear, viewMonth, day, selectedHour, selectedMinute, selectedPeriod);
  };

  const handleUpdateTime = (h: string, min: string, p: "AM" | "PM") => {
    setSelectedHour(h);
    setSelectedMinute(min);
    setSelectedPeriod(p);
    emitChange(viewYear, viewMonth, selectedDay, h, min, p);
  };

  const formatDisplay = (val: string) => {
    if (!val) return "";
    try {
      const parsed = parseDateTime(val);
      const mName = monthNames[parsed.month]?.slice(0, 3) || "";
      return `${mName} ${parsed.day}, ${parsed.year} at ${parsed.hour}:${parsed.minute} ${parsed.period}`;
    } catch {
      return val;
    }
  };

  const hours = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDayIndex = firstDayOfMonth(viewYear, viewMonth);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block font-bold text-xs text-charcoal/70 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Trigger */}
      <div ref={triggerRef} className="relative">
        <div
          onClick={handleToggle}
          className={`w-full bg-ivory-light p-2.5 pl-8 pr-7 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs font-bold text-charcoal h-[41px] ${
            isOpen ? "border-indigo-600 ring-2 ring-indigo-100 bg-white" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <span className={`truncate ${value ? "text-charcoal font-bold" : "text-charcoal/40 font-normal"}`}>
            {value ? formatDisplay(value) : placeholder}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-charcoal/40 shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-indigo-600" : ""
            }`}
          />
        </div>
      </div>

      {/* Portal Popover */}
      {isOpen && coords && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />

          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999
            }}
            className="w-[320px] sm:w-[480px] bg-white rounded-2xl shadow-2xl border border-indigo-100 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header Display */}
            <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-indigo-950 via-indigo-900 to-teal-900 text-white rounded-xl shadow-xs flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-amber-300" />
                <span className="font-extrabold text-xs text-indigo-100">
                  {monthNames[viewMonth].slice(0, 3)} {selectedDay}, {viewYear}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-amber-300" />
                <span className="font-black text-sm text-white">
                  {selectedHour}:{selectedMinute} {selectedPeriod}
                </span>
              </div>
            </div>

            {/* Split Grid: Date on Left, Time on Right */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              {/* Left Column: Date Calendar */}
              <div className="space-y-2 pr-0 sm:pr-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1 rounded-lg hover:bg-gray-100 text-charcoal/60 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-xs text-charcoal">
                    {monthNames[viewMonth]} {viewYear}
                  </span>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1 rounded-lg hover:bg-gray-100 text-charcoal/60 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 text-center text-[9px] font-black uppercase text-charcoal/40">
                  <span className="text-rose-500">Su</span>
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span className="text-indigo-600">Sa</span>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {Array.from({ length: startDayIndex }).map((_, idx) => (
                    <div key={`prev-${idx}`} className="py-1 text-[11px] text-charcoal/20 select-none" />
                  ))}

                  {Array.from({ length: totalDays }).map((_, idx) => {
                    const d = idx + 1;
                    const isSelected = selectedDay === d;
                    return (
                      <button
                        key={`day-${d}`}
                        type="button"
                        onClick={() => handleSelectDay(d)}
                        className={`py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white font-black shadow-xs"
                            : "text-charcoal hover:bg-indigo-50 hover:text-indigo-600"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Time Picker */}
              <div className="space-y-2.5 pt-2 sm:pt-0 sm:pl-3">
                {/* AM / PM Segmented Control */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-charcoal/50">Period</span>
                  <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                    <button
                      type="button"
                      onClick={() => handleUpdateTime(selectedHour, selectedMinute, "AM")}
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        selectedPeriod === "AM"
                          ? "bg-amber-400 text-charcoal shadow-xs"
                          : "text-charcoal/60 hover:text-charcoal"
                      }`}
                    >
                      <Sun className="w-2.5 h-2.5" />
                      <span>AM</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateTime(selectedHour, selectedMinute, "PM")}
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        selectedPeriod === "PM"
                          ? "bg-amber-400 text-charcoal shadow-xs"
                          : "text-charcoal/60 hover:text-charcoal"
                      }`}
                    >
                      <Moon className="w-2.5 h-2.5" />
                      <span>PM</span>
                    </button>
                  </div>
                </div>

                {/* Hours */}
                <div>
                  <span className="block text-[10px] font-black uppercase text-charcoal/50 mb-1">
                    Hour ({selectedHour})
                  </span>
                  <div className="grid grid-cols-6 gap-1">
                    {hours.map((h) => {
                      const isSel = selectedHour === h;
                      return (
                        <button
                          key={`hr-${h}`}
                          type="button"
                          onClick={() => handleUpdateTime(h, selectedMinute, selectedPeriod)}
                          className={`py-1 text-[11px] rounded font-bold transition-all cursor-pointer ${
                            isSel
                              ? "bg-indigo-600 text-white font-black shadow-xs"
                              : "bg-gray-50 text-charcoal/80 hover:bg-indigo-50 hover:text-indigo-600"
                          }`}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Minutes */}
                <div>
                  <span className="block text-[10px] font-black uppercase text-charcoal/50 mb-1">
                    Minute (:{selectedMinute})
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    {minutes.map((m) => {
                      const isSel = selectedMinute === m;
                      return (
                        <button
                          key={`min-${m}`}
                          type="button"
                          onClick={() => handleUpdateTime(selectedHour, m, selectedPeriod)}
                          className={`py-1 text-[11px] rounded font-bold transition-all cursor-pointer ${
                            isSel
                              ? "bg-amber-400 text-charcoal font-black shadow-xs"
                              : "bg-gray-50 text-charcoal/80 hover:bg-amber-50 hover:text-amber-950"
                          }`}
                        >
                          :{m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="text-[11px] font-semibold text-charcoal/40 hover:text-rose-500 cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!value) {
                    emitChange(viewYear, viewMonth, selectedDay, selectedHour, selectedMinute, selectedPeriod);
                  }
                  setIsOpen(false);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

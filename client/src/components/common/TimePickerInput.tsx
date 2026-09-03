import React, { useState, useRef, useEffect } from "react";
import { Clock, ChevronDown, Check, Sun, Moon, Sparkles, X } from "lucide-react";

interface TimePickerInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export const TimePickerInput: React.FC<TimePickerInputProps> = ({
  label,
  value,
  onChange,
  placeholder = "e.g. 7:00 PM",
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse existing value (e.g. "7:00 PM" or "07:30 AM")
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hour: "7", minute: "00", period: "PM" };
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      if (h === 0) h = 12;
      if (h > 12) h = h - 12;
      return {
        hour: String(h),
        minute: match[2],
        period: (match[3] || "PM").toUpperCase() as "AM" | "PM"
      };
    }
    return { hour: "7", minute: "00", period: "PM" };
  };

  const current = parseTime(value);
  const [selectedHour, setSelectedHour] = useState<string>(current.hour);
  const [selectedMinute, setSelectedMinute] = useState<string>(current.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(current.period);

  // Sync state when value changes from outside
  useEffect(() => {
    if (value) {
      const parsed = parseTime(value);
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
      setSelectedPeriod(parsed.period);
    }
  }, [value]);

  // Handle outside click to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hours = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const minutes = ["00", "15", "30", "45"];
  const commonPresets = [
    "8:00 AM",
    "9:00 AM",
    "10:00 AM",
    "1:00 PM",
    "2:00 PM",
    "4:00 PM",
    "6:00 PM",
    "7:00 PM",
    "7:30 PM",
    "8:00 PM"
  ];

  const updateTime = (h: string, m: string, p: "AM" | "PM") => {
    setSelectedHour(h);
    setSelectedMinute(m);
    setSelectedPeriod(p);
    onChange(`${h}:${m} ${p}`);
  };

  const handlePresetClick = (preset: string) => {
    const parsed = parseTime(preset);
    updateTime(parsed.hour, parsed.minute, parsed.period);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block font-bold text-xs text-charcoal/70">{label}</label>
          <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-500" />
            <span>Timepicker</span>
          </span>
        </div>
      )}

      {/* Trigger Input */}
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full bg-ivory-light p-2.5 pl-9 pr-8 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs font-bold text-charcoal ${
            isOpen ? "border-indigo ring-2 ring-indigo-100 bg-white" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <Clock className="w-4 h-4 text-indigo-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <span className={value ? "text-charcoal font-bold" : "text-charcoal/40 font-normal"}>
            {value || placeholder}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-charcoal/40 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-indigo-600" : ""
            }`}
          />
        </div>
      </div>

      {/* Rich Visual Timepicker Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-indigo-100 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Display & AM/PM Toggle */}
          <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-indigo-900 to-indigo text-white rounded-xl shadow-xs">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black tracking-tight">{selectedHour}</span>
              <span className="text-xl font-bold text-indigo-200 animate-pulse">:</span>
              <span className="text-xl font-black tracking-tight">{selectedMinute}</span>
              <span className="text-xs font-bold text-amber-300 ml-1.5">{selectedPeriod}</span>
            </div>

            {/* AM / PM Segmented Control */}
            <div className="flex items-center bg-indigo-950/70 p-0.5 rounded-lg border border-indigo-700/60">
              <button
                type="button"
                onClick={() => updateTime(selectedHour, selectedMinute, "AM")}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedPeriod === "AM"
                    ? "bg-amber-400 text-charcoal shadow-xs"
                    : "text-indigo-200 hover:text-white"
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>AM</span>
              </button>
              <button
                type="button"
                onClick={() => updateTime(selectedHour, selectedMinute, "PM")}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedPeriod === "PM"
                    ? "bg-amber-400 text-charcoal shadow-xs"
                    : "text-indigo-200 hover:text-white"
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>PM</span>
              </button>
            </div>
          </div>

          {/* Hours Grid */}
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-charcoal/50 mb-1.5">
              <span>Select Hour</span>
              <span className="text-indigo-600 font-semibold">{selectedHour} o'clock</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {hours.map((h) => {
                const isSelected = selectedHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => updateTime(h, selectedMinute, selectedPeriod)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo text-white shadow-xs font-black ring-1 ring-indigo-300"
                        : "bg-gray-50 text-charcoal/80 hover:bg-indigo-50 hover:text-indigo"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minutes Row */}
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-charcoal/50 mb-1.5">
              <span>Select Minute</span>
              <span className="text-indigo-600 font-semibold">{selectedMinute} mins</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {minutes.map((m) => {
                const isSelected = selectedMinute === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateTime(selectedHour, m, selectedPeriod)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-400 text-charcoal shadow-xs font-black ring-1 ring-amber-500"
                        : "bg-gray-50 text-charcoal/80 hover:bg-amber-50 hover:text-amber-950"
                    }`}
                  >
                    :{m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Preset Chips */}
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-charcoal/50 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Quick Presets</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {commonPresets.slice(0, 6).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className="px-2 py-0.5 rounded-md bg-ivory-light hover:bg-indigo-50 border border-gray-200 text-[10px] font-semibold text-charcoal/70 hover:text-indigo hover:border-indigo-200 transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Confirm Footer */}
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
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-indigo hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

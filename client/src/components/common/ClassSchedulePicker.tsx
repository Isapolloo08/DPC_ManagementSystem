import React, { useState, useRef, useEffect } from "react";
import {
  Clock,
  Calendar,
  Layers,
  Edit3,
  Check,
  ChevronDown,
  X,
  Plus,
  Trash2,
  Sparkles,
  Sun,
  Sunset,
  Moon,
  Briefcase,
  ArrowRight,
  Navigation
} from "lucide-react";
import { TimePickerInput } from "./TimePickerInput";

export interface ClassSchedulePickerProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export interface ScheduleSlot {
  id: string;
  days: string[]; // e.g. ["Mon", "Wed"]
  timePreset: string; // e.g. "8:00 AM - 5:00 PM" or "Custom"
  customStartTime: string;
  customEndTime: string;
}

const ALL_DAYS = [
  { key: "Mon", label: "Mon", full: "Monday" },
  { key: "Tue", label: "Tue", full: "Tuesday" },
  { key: "Wed", label: "Wed", full: "Wednesday" },
  { key: "Thu", label: "Thu", full: "Thursday" },
  { key: "Fri", label: "Fri", full: "Friday" },
  { key: "Sat", label: "Sat", full: "Saturday" },
  { key: "Sun", label: "Sun", full: "Sunday" }
];

const STANDARD_TIME_PRESETS = [
  {
    label: "8:00 AM - 12:00 PM",
    shift: "Morning",
    start: "8:00 AM",
    end: "12:00 PM",
    icon: Sun,
    color: "amber"
  },
  {
    label: "1:00 PM - 5:00 PM",
    shift: "Afternoon",
    start: "1:00 PM",
    end: "5:00 PM",
    icon: Sunset,
    color: "orange"
  },
  {
    label: "8:00 AM - 5:00 PM",
    shift: "Whole Day",
    start: "8:00 AM",
    end: "5:00 PM",
    icon: Briefcase,
    color: "indigo"
  },
  {
    label: "7:30 AM - 4:30 PM",
    shift: "Regular",
    start: "7:30 AM",
    end: "4:30 PM",
    icon: Clock,
    color: "teal"
  },
  {
    label: "5:00 PM - 8:30 PM",
    shift: "Evening",
    start: "5:00 PM",
    end: "8:30 PM",
    icon: Moon,
    color: "purple"
  }
];

// Helper to format days concisely (e.g. M-W, Th-F, MWF, TTH, Mon-Fri)
const formatDaysAbbr = (days: string[]): string => {
  if (!days || days.length === 0) return "";
  const set = new Set(days);
  if (set.has("Mon") && set.has("Wed") && set.has("Fri") && days.length === 3) return "MWF";
  if (set.has("Tue") && set.has("Thu") && days.length === 2) return "TTH";
  if (set.has("Mon") && set.has("Tue") && set.has("Wed") && set.has("Thu") && set.has("Fri") && days.length === 5) return "Mon-Fri";
  if (set.has("Sat") && set.has("Sun") && days.length === 2) return "Sat-Sun";
  if (days.length === 7) return "Daily";
  if (set.has("Mon") && set.has("Wed") && days.length === 2) return "M-W";
  if (set.has("Thu") && set.has("Fri") && days.length === 2) return "Th-F";
  if (set.has("Mon") && set.has("Tue") && days.length === 2) return "M-T";
  if (set.has("Wed") && set.has("Thu") && days.length === 2) return "W-Th";
  return days.join(", ");
};

// Create a new blank slot
const createNewSlot = (defaultDays: string[] = ["Mon", "Wed"], defaultTime = "8:00 AM - 5:00 PM"): ScheduleSlot => ({
  id: Math.random().toString(36).substring(2, 9),
  days: defaultDays,
  timePreset: defaultTime,
  customStartTime: "8:00 AM",
  customEndTime: "5:00 PM"
});

export const ClassSchedulePicker: React.FC<ClassSchedulePickerProps> = ({
  label = "Class Schedule",
  value,
  onChange,
  placeholder = "e.g. M-W 8:00 AM - 5:00 PM, Th-F 1:00 PM - 5:00 PM",
  className = ""
}) => {
  const [isManualMode, setIsManualMode] = useState(false);
  const [slots, setSlots] = useState<ScheduleSlot[]>([
    createNewSlot(["Mon", "Wed"], "8:00 AM - 5:00 PM")
  ]);

  // Compile slots to unified formatted string
  const compileSlotsToString = (currentSlots: ScheduleSlot[]): string => {
    const compiledParts: string[] = [];

    currentSlots.forEach((slot) => {
      const daysText = formatDaysAbbr(slot.days);
      const timeText = slot.timePreset === "Custom"
        ? `${slot.customStartTime || "8:00 AM"} - ${slot.customEndTime || "5:00 PM"}`
        : slot.timePreset;

      if (daysText && timeText) {
        compiledParts.push(`${daysText} ${timeText}`);
      } else if (daysText) {
        compiledParts.push(daysText);
      } else if (timeText) {
        compiledParts.push(timeText);
      }
    });

    return compiledParts.join(", ");
  };

  // Sync builder changes to parent
  const updateSlots = (newSlots: ScheduleSlot[]) => {
    setSlots(newSlots);
    if (!isManualMode) {
      const compiled = compileSlotsToString(newSlots);
      if (compiled) {
        onChange(compiled);
      }
    }
  };

  // Toggle specific day in a slot
  const handleToggleDay = (slotId: string, day: string) => {
    const next = slots.map((s) => {
      if (s.id !== slotId) return s;
      const exists = s.days.includes(day);
      const newDays = exists ? s.days.filter((d) => d !== day) : [...s.days, day];
      // Sort in standard order
      const sortedDays = ALL_DAYS.map((d) => d.key).filter((d) => newDays.includes(d));
      return { ...s, days: sortedDays };
    });
    updateSlots(next);
  };

  // Quick preset shortcuts for days in a slot
  const handleSetQuickDays = (slotId: string, combo: "MWF" | "TTH" | "M-W" | "Th-F" | "Mon-Fri" | "Sat") => {
    const comboMap: Record<string, string[]> = {
      MWF: ["Mon", "Wed", "Fri"],
      TTH: ["Tue", "Thu"],
      "M-W": ["Mon", "Wed"],
      "Th-F": ["Thu", "Fri"],
      "Mon-Fri": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      Sat: ["Sat"]
    };

    const next = slots.map((s) => (s.id === slotId ? { ...s, days: comboMap[combo] || s.days } : s));
    updateSlots(next);
  };

  // Set time preset for a slot
  const handleSetTimePreset = (slotId: string, presetObj: typeof STANDARD_TIME_PRESETS[0] | "Custom") => {
    const next = slots.map((s) => {
      if (s.id !== slotId) return s;
      if (presetObj === "Custom") {
        return { ...s, timePreset: "Custom" };
      }
      return {
        ...s,
        timePreset: presetObj.label,
        customStartTime: presetObj.start,
        customEndTime: presetObj.end
      };
    });
    updateSlots(next);
  };

  // Set custom time range using TimePickerInput
  const handleSetCustomTime = (slotId: string, field: "customStartTime" | "customEndTime", val: string) => {
    const next = slots.map((s) => (s.id === slotId ? { ...s, timePreset: "Custom", [field]: val } : s));
    updateSlots(next);
  };

  // Add another day/time slot
  const handleAddSlot = () => {
    const defaultDays = slots.length === 1 ? ["Thu", "Fri"] : ["Sat"];
    const defaultTime = slots.length === 1 ? "1:00 PM - 5:00 PM" : "8:00 AM - 12:00 PM";
    const next = [...slots, createNewSlot(defaultDays, defaultTime)];
    updateSlots(next);
  };

  // Remove slot
  const handleRemoveSlot = (slotId: string) => {
    if (slots.length <= 1) return;
    const next = slots.filter((s) => s.id !== slotId);
    updateSlots(next);
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header with Title and Mode Toggle */}
      <div className="flex items-center justify-between">
        <label className="block font-bold text-xs text-charcoal/80 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span>{label}</span>
          <span className="text-[10px] font-normal text-charcoal/40 hidden sm:inline">
            (Multi-day & multi-shift supported)
          </span>
        </label>

        <button
          type="button"
          onClick={() => {
            const nextMode = !isManualMode;
            setIsManualMode(nextMode);
            if (nextMode && !value) {
              const compiled = compileSlotsToString(slots);
              if (compiled) onChange(compiled);
            }
          }}
          className={`text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all px-2.5 py-1 rounded-xl shadow-2xs border ${
            isManualMode
              ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300"
              : "bg-white hover:bg-gray-50 text-indigo-800 border-indigo-200/80 hover:border-indigo-300"
          }`}
        >
          {isManualMode ? (
            <>
              <Layers className="w-3.5 h-3.5 text-amber-700" />
              <span>Use Visual Schedule Builder</span>
            </>
          ) : (
            <>
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Type Manually</span>
            </>
          )}
        </button>
      </div>

      {isManualMode ? (
        /* Option 2: Freeform Manual Input */
        <div className="p-3.5 bg-gradient-to-br from-amber-50/40 via-white to-ivory-light rounded-2xl border border-amber-200 shadow-2xs space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-amber-950 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
              <span>Manual Freeform Entry</span>
            </span>
            <span className="text-[10px] text-charcoal/50">
              Type custom irregular days or hours
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-white p-2.5 pr-8 rounded-xl border border-amber-300/80 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 text-xs font-semibold text-charcoal shadow-2xs placeholder:text-charcoal/40"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="p-1 text-charcoal/40 hover:text-charcoal absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Option 1: Interactive Day & Time Schedule Builder */
        <div className="p-3 sm:p-4 bg-gradient-to-br from-indigo-50/40 via-white to-amber-50/20 rounded-2xl border border-indigo-100 shadow-xs space-y-3">
          {slots.map((slot, index) => {
            const daysDisplay = formatDaysAbbr(slot.days) || "No days selected";
            const timeDisplay = slot.timePreset === "Custom"
              ? `${slot.customStartTime || "8:00 AM"} - ${slot.customEndTime || "5:00 PM"}`
              : slot.timePreset;

            return (
              <div
                key={slot.id}
                className="p-3 bg-white rounded-2xl border border-indigo-100/90 shadow-xs space-y-3 transition-all hover:border-indigo-200"
              >
                {/* Slot Header Badge & Summary */}
                <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 font-bold text-charcoal flex-wrap">
                    <span className="w-5 h-5 rounded-lg bg-indigo text-white text-[11px] flex items-center justify-center font-black shadow-xs">
                      {index + 1}
                    </span>
                    <span className="text-indigo-950 font-black">
                      Schedule Shift {slots.length > 1 ? `#${index + 1}` : ""}
                    </span>
                    <span className="text-[11px] bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded-lg border border-indigo-100 flex items-center gap-1 shadow-2xs">
                      <Clock className="w-3 h-3 text-indigo-600" />
                      <span>{daysDisplay}</span>
                      <span className="text-indigo-400">•</span>
                      <span>{timeDisplay}</span>
                    </span>
                  </div>

                  {slots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slot.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer transition-colors"
                      title="Remove this schedule shift"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* 1. Select Days */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-charcoal/70">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block"></span>
                      <span>1. Select Class Days:</span>
                    </span>

                    {/* Quick Combo Shortcuts */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-charcoal/40 font-normal hidden sm:inline">Presets:</span>
                      {(["MWF", "TTH", "M-W", "Th-F", "Mon-Fri", "Sat"] as const).map((combo) => (
                        <button
                          key={combo}
                          type="button"
                          onClick={() => handleSetQuickDays(slot.id, combo)}
                          className="px-2 py-0.5 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 text-[10px] font-black text-indigo-900 border border-indigo-100 transition-colors cursor-pointer"
                        >
                          {combo}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Day Buttons Grid */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {ALL_DAYS.map((d) => {
                      const isSelected = slot.days.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => handleToggleDay(slot.id, d.key)}
                          className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer text-center flex flex-col items-center justify-center ${
                            isSelected
                              ? "bg-indigo text-white shadow-sm ring-2 ring-indigo-300 scale-[1.02]"
                              : "bg-gray-50 hover:bg-gray-100 text-charcoal/70 border border-gray-200/60"
                          }`}
                        >
                          <span>{d.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Select Time Range */}
                <div className="space-y-2 pt-1 border-t border-gray-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-charcoal/70">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                      <span>2. Select Time Range:</span>
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                    {STANDARD_TIME_PRESETS.map((preset) => {
                      const isSelected = slot.timePreset === preset.label;
                      const IconComponent = preset.icon;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleSetTimePreset(slot.id, preset)}
                          className={`p-2 rounded-xl text-left text-xs font-bold transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                            isSelected
                              ? "bg-gradient-to-br from-amber-50 to-amber-100/80 text-amber-950 border-2 border-amber-400 shadow-xs ring-1 ring-amber-300"
                              : "bg-gray-50/80 hover:bg-gray-100/90 text-charcoal/80 border border-gray-200/60"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] uppercase font-black tracking-wider text-charcoal/50 flex items-center gap-1">
                              <IconComponent className="w-3 h-3 text-amber-600" />
                              <span>{preset.shift}</span>
                            </span>
                            {isSelected && <Check className="w-3 h-3 text-amber-700" />}
                          </div>
                          <span className="text-[11px] font-bold truncate leading-tight">
                            {preset.label}
                          </span>
                        </button>
                      );
                    })}

                    {/* Custom Time Option Toggle */}
                    <button
                      type="button"
                      onClick={() => handleSetTimePreset(slot.id, "Custom")}
                      className={`p-2 rounded-xl text-left text-xs font-bold transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                        slot.timePreset === "Custom"
                          ? "bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-950 border-2 border-indigo-500 shadow-xs ring-1 ring-indigo-300"
                          : "bg-gray-50/80 hover:bg-gray-100/90 text-charcoal/80 border border-gray-200/60"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600 flex items-center gap-1">
                          <Edit3 className="w-3 h-3" />
                          <span>Custom</span>
                        </span>
                        {slot.timePreset === "Custom" && <Check className="w-3 h-3 text-indigo-700" />}
                      </div>
                      <span className="text-[11px] font-bold text-indigo-900 truncate leading-tight">
                        Pick Hours
                      </span>
                    </button>
                  </div>

                  {/* Custom Time Range Picker with TimePickerInput */}
                  {slot.timePreset === "Custom" && (
                    <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2 animate-in fade-in zoom-in-98 duration-150">
                      <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Choose Custom Shift Hours</span>
                        </span>
                        <span className="text-[10px] font-normal text-indigo-700/80">
                          Click either box to open interactive time selector
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <TimePickerInput
                          label="Start Time"
                          value={slot.customStartTime}
                          onChange={(v) => handleSetCustomTime(slot.id, "customStartTime", v)}
                          placeholder="e.g. 7:30 AM"
                        />
                        <TimePickerInput
                          label="End Time"
                          value={slot.customEndTime}
                          onChange={(v) => handleSetCustomTime(slot.id, "customEndTime", v)}
                          placeholder="e.g. 4:30 PM"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Another Day/Time Shift Button */}
          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAddSlot}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-indigo-50/80 text-indigo-950 border border-indigo-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-xs hover:border-indigo-300"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>+ Add Another Shift (e.g. Th-F 1:00 PM - 5:00 PM)</span>
            </button>

            <span className="text-[11px] text-charcoal/50 font-medium">
              Combine multi-day & split-schedule classes
            </span>
          </div>

          {/* Real-Time Live Compiled Schedule Banner */}
          {value && (
            <div className="p-2.5 rounded-xl bg-white border border-indigo-100 flex items-center gap-2.5 text-xs shadow-2xs">
              <span className="font-black text-indigo-900 shrink-0 text-[10px] uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                <Navigation className="w-3 h-3 text-indigo-600" />
                <span>Active Schedule:</span>
              </span>
              <span className="font-bold text-indigo-950 truncate flex-1">{value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClassSchedulePicker;

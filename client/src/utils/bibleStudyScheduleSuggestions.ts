export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface ScheduleParticipant {
  id: number;
  name: string;
  class_schedule?: string | null;
}

interface BusySlot { day: number; start: number; end: number }
export interface ParsedSchedule { slots: BusySlot[]; complete: boolean }
export interface ScheduleSuggestion {
  day: string;
  start: number;
  end: number;
  clear: ScheduleParticipant[];
  conflicts: ScheduleParticipant[];
  unknown: ScheduleParticipant[];
  leaderStatus: "clear" | "unknown";
}

export function parseScheduleTime(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > (match[3] ? 12 : 23) || (match[3] && hour < 1)) return null;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return hour * 60 + minute;
}

export function formatScheduleTime(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function parseDays(value: string): number[] | null {
  const text = value.trim().toLowerCase();
  if (text === "daily") return [0, 1, 2, 3, 4, 5, 6];
  if (text === "mwf") return [0, 2, 4];
  if (text === "tth") return [1, 3];
  const dayIndex = (day: string) => WEEKDAYS.findIndex(full => full.toLowerCase() === day || full.slice(0, 3).toLowerCase() === day);
  const range = text.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s*-\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)$/);
  if (range) {
    const start = dayIndex(range[1]), end = dayIndex(range[2]);
    return Array.from({ length: (end - start + 7) % 7 + 1 }, (_, index) => (start + index) % 7);
  }
  const aliases: Record<string, number> = { m: 0, t: 1, w: 2, th: 3, f: 4 };
  const tokens = text.split(/\s*(?:,|-|\/|&|\band\b)\s*/);
  const days = tokens.map(day => aliases[day] ?? dayIndex(day));
  return days.length && days.every(day => day >= 0) ? [...new Set(days)] : null;
}

/** Read the picker format and explicit day/time ranges. Unreadable text stays unknown. */
export function parseBusySchedule(value?: string | null): ParsedSchedule {
  if (!value?.trim()) return { slots: [], complete: false };
  const normalized = value.replace(/[–—]/g, "-");
  const times = /(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:-|\bto\b)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi;
  const slots: BusySlot[] = [];
  let cursor = 0, complete = true;
  for (const match of normalized.matchAll(times)) {
    const prefix = normalized.slice(cursor, match.index).replace(/^[\s,;]+|[\s:]+$/g, "");
    const days = parseDays(prefix);
    const start = parseScheduleTime(match[1]), end = parseScheduleTime(match[2]);
    cursor = match.index! + match[0].length;
    if (!days || start === null || end === null || start === end) { complete = false; continue; }
    for (const day of days) {
      if (end > start) slots.push({ day, start, end });
      else {
        slots.push({ day, start, end: 1440 });
        slots.push({ day: (day + 1) % 7, start: 0, end });
      }
    }
  }
  if (normalized.slice(cursor).replace(/[\s,;]+/g, "")) complete = false;
  return { slots, complete: complete && slots.length > 0 };
}

export function suggestBibleStudySchedules(members: ScheduleParticipant[], leader: ScheduleParticipant | null,
  options: { duration: number; days: string[]; start: number; end: number }): ScheduleSuggestion[] {
  if (!members.length || options.duration <= 0 || options.start < 0 || options.end > 1440 || options.start >= options.end) return [];
  const parsed = members.map(member => ({ member, schedule: parseBusySchedule(member.class_schedule) }));
  if (!parsed.some(item => item.schedule.slots.length)) return [];
  const leaderSchedule = parseBusySchedule(leader?.class_schedule);
  const overlaps = (schedule: ParsedSchedule, day: number, start: number, end: number) =>
    schedule.slots.some(slot => slot.day === day && start < slot.end && end > slot.start);
  const candidates: ScheduleSuggestion[] = [];
  for (const [dayIndex, day] of WEEKDAYS.entries()) {
    if (!options.days.includes(day)) continue;
    for (let start = options.start; start + options.duration <= options.end; start += 30) {
      const end = start + options.duration;
      if (overlaps(leaderSchedule, dayIndex, start, end)) continue;
      const candidate: ScheduleSuggestion = { day, start, end, clear: [], conflicts: [], unknown: [], leaderStatus: leaderSchedule.complete ? "clear" : "unknown" };
      for (const { member, schedule } of parsed) {
        if (overlaps(schedule, dayIndex, start, end)) candidate.conflicts.push(member);
        else if (schedule.complete) candidate.clear.push(member);
        else candidate.unknown.push(member);
      }
      if (candidate.clear.length) candidates.push(candidate);
    }
  }
  candidates.sort((a, b) => b.clear.length - a.clear.length || a.conflicts.length - b.conflicts.length || WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) || a.start - b.start);
  const results: ScheduleSuggestion[] = [];
  for (const candidate of candidates) {
    // Offer distinct options instead of five overlapping starts for the same session.
    if (results.some(result => result.day === candidate.day && candidate.start < result.end && candidate.end > result.start)) continue;
    results.push(candidate);
    if (results.length === 5) break;
  }
  return results;
}

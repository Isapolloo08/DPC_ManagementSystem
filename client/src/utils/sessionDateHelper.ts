/**
 * sessionDateHelper.ts
 * Pure utilities for computing weekly Bible Study session dates based on the group's schedule,
 * start time, and current timezone (Asia/Manila).
 */

export interface GeneratedSession {
  date: string; // Normalized "YYYY-MM-DD"
  formattedDate: string; // e.g. "Thu, Sep 17"
  dayName: string; // "Thursday"
  isLatest: boolean;
}

export interface ManilaDateTime {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dayIndex: number; // 0-6 (0 = Sunday)
  hour: number; // 0-23
  minute: number; // 0-59
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const SHORT_DAY_TO_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Parses start time string (e.g. "5:00 PM - 8:00 PM", "17:00", "7:00 PM", "7 PM")
 * Returns 24-hour hour and minute.
 */
export function parseStartTime(timeStr?: string | null): { hour: number; minute: number } {
  if (!timeStr || !timeStr.trim()) {
    return { hour: 0, minute: 0 };
  }

  const clean = timeStr.trim().split(/[-–—to]/i)[0].trim().toUpperCase();
  const match = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) {
    return { hour: 0, minute: 0 };
  }

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];

  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return { hour: Math.min(23, Math.max(0, hour)), minute: Math.min(59, Math.max(0, minute)) };
}

/**
 * Extracts year, month, day, dayIndex, hour, minute in Asia/Manila timezone.
 */
export function getManilaDateTime(refDate: Date | string = new Date()): ManilaDateTime {
  const dateObj = typeof refDate === "string" ? new Date(refDate) : refDate;
  
  if (isNaN(dateObj.getTime())) {
    const fallback = new Date();
    return getManilaDateTime(fallback);
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(dateObj);
  let year = 2026, month = 1, day = 1, hour = 0, minute = 0, weekdayShort = "sun";

  for (const p of parts) {
    if (p.type === "year") year = parseInt(p.value, 10);
    if (p.type === "month") month = parseInt(p.value, 10);
    if (p.type === "day") day = parseInt(p.value, 10);
    if (p.type === "hour") hour = parseInt(p.value, 10) % 24;
    if (p.type === "minute") minute = parseInt(p.value, 10);
    if (p.type === "weekday") weekdayShort = p.value.toLowerCase().slice(0, 3);
  }

  const dayIndex = SHORT_DAY_TO_INDEX[weekdayShort] ?? 0;
  return { year, month, day, dayIndex, hour, minute };
}

export function formatYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Generates the last `weeksBack` sessions counting back from the most recent session
 * that has already started or passed. Excludes future sessions.
 */
export function getSessionDates(
  schedDay?: string | null,
  schedTime?: string | null,
  weeksBack = 8,
  referenceNow?: Date | string
): GeneratedSession[] {
  if (!schedDay || !schedDay.trim()) {
    return [];
  }

  const targetDayIndex = DAY_NAME_TO_INDEX[schedDay.trim().toLowerCase()];
  if (targetDayIndex === undefined) {
    return [];
  }

  const manila = getManilaDateTime(referenceNow || new Date());
  const parsedStartTime = parseStartTime(schedTime);

  // Reference midnight date in UTC matching Manila local date components
  const refMidnightUTC = new Date(Date.UTC(manila.year, manila.month - 1, manila.day));

  let daysBackToMostRecent = (manila.dayIndex - targetDayIndex + 7) % 7;

  // If today is the session day (daysBackToMostRecent === 0), verify start time
  if (daysBackToMostRecent === 0) {
    const isStartedOrPassed =
      manila.hour > parsedStartTime.hour ||
      (manila.hour === parsedStartTime.hour && manila.minute >= parsedStartTime.minute);

    // If session hasn't started yet today, exclude today and jump to last week
    if (!isStartedOrPassed) {
      daysBackToMostRecent = 7;
    }
  }

  const mostRecentUTC = new Date(refMidnightUTC.getTime() - daysBackToMostRecent * 24 * 60 * 60 * 1000);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayNamesFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const sessions: GeneratedSession[] = [];
  const count = Math.max(1, weeksBack);

  for (let i = 0; i < count; i++) {
    const sessionUTC = new Date(mostRecentUTC.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const y = sessionUTC.getUTCFullYear();
    const m = sessionUTC.getUTCMonth() + 1;
    const d = sessionUTC.getUTCDate();
    const dayIdx = sessionUTC.getUTCDay();

    const dateStr = formatYMD(y, m, d);
    const formattedDate = `${dayNamesShort[dayIdx]}, ${monthNames[m - 1]} ${d}`;

    sessions.push({
      date: dateStr,
      formattedDate,
      dayName: dayNamesFull[dayIdx],
      isLatest: i === 0,
    });
  }

  return sessions;
}

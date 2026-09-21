/**
 * scheduleHelper.ts
 * Utilities for computing smart meeting dates, schedule alignments,
 * and quick-pick chips for small group Bible Study attendance.
 */

export interface ScheduleDateChip {
  label: string;
  date: string;
  isTargetDay: boolean;
  isToday?: boolean;
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

/**
 * Format a Date object to YYYY-MM-DD in local time
 */
export function formatDateToYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a given date string (YYYY-MM-DD) falls on the group's designated meeting day.
 */
export function isDateMatchingSchedule(dateStr?: string | null, meetingDayStr?: string | null): boolean {
  if (!dateStr || !meetingDayStr) return true;
  const targetDayIndex = DAY_NAME_TO_INDEX[meetingDayStr.trim().toLowerCase()];
  if (targetDayIndex === undefined) return true;

  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return true;
  const selectedDate = new Date(y, m - 1, d);
  return selectedDate.getDay() === targetDayIndex;
}

/**
 * Calculates smart default date and quick-pick chips for a small group's scheduled meeting day.
 */
export function getScheduleDates(meetingDayStr?: string | null): {
  defaultDate: string;
  chips: ScheduleDateChip[];
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDay = today.getDay();
  const todayStr = formatDateToYMD(today);

  const formatShort = (d: Date) => {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  const targetDayIndex = meetingDayStr && DAY_NAME_TO_INDEX[meetingDayStr.trim().toLowerCase()] !== undefined
    ? DAY_NAME_TO_INDEX[meetingDayStr.trim().toLowerCase()]
    : null;

  if (targetDayIndex === null) {
    return {
      defaultDate: todayStr,
      chips: [
        {
          label: `Today (${formatShort(today)})`,
          date: todayStr,
          isTargetDay: true,
          isToday: true,
        },
      ],
    };
  }

  // Calculate most recent occurrence of meeting_day (or today if today is meeting_day)
  const diffPast = (todayDay - targetDayIndex + 7) % 7;
  const recentTarget = new Date(today);
  recentTarget.setDate(today.getDate() - diffPast);

  // Previous week's meeting_day
  const prevWeekTarget = new Date(recentTarget);
  prevWeekTarget.setDate(recentTarget.getDate() - 7);

  // Next week's meeting_day
  const diffNext = (targetDayIndex - todayDay + 7) % 7 || 7;
  const nextTarget = new Date(today);
  nextTarget.setDate(today.getDate() + diffNext);

  // Following week's meeting_day
  const followingTarget = new Date(nextTarget);
  followingTarget.setDate(nextTarget.getDate() + 7);

  // Default date: If today is the meeting day, use today. Otherwise use the most recent meeting day.
  const defaultDate = diffPast === 0 ? todayStr : formatDateToYMD(recentTarget);

  const cleanMeetingDay = meetingDayStr ? meetingDayStr.trim() : "Meeting Day";

  const chips: ScheduleDateChip[] = [
    {
      label: `Last ${cleanMeetingDay} (${formatShort(prevWeekTarget)})`,
      date: formatDateToYMD(prevWeekTarget),
      isTargetDay: true,
    },
    {
      label: diffPast === 0 ? `Today (${formatShort(recentTarget)})` : `This ${cleanMeetingDay} (${formatShort(recentTarget)})`,
      date: formatDateToYMD(recentTarget),
      isTargetDay: true,
      isToday: diffPast === 0,
    },
    {
      label: `Next ${cleanMeetingDay} (${formatShort(nextTarget)})`,
      date: formatDateToYMD(nextTarget),
      isTargetDay: true,
    },
  ];

  // If today is NOT the scheduled meeting day, add today as a quick option too
  if (diffPast !== 0) {
    chips.push({
      label: `Today (${formatShort(today)})`,
      date: todayStr,
      isTargetDay: false,
      isToday: true,
    });
  }

  return { defaultDate, chips };
}

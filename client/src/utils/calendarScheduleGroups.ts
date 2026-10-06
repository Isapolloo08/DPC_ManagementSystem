interface ScheduledActivity {
  date_str: string;
  end_date_str?: string;
  start_time_iso?: string;
  end_time_iso?: string;
  time_formatted: string;
}

/** Keep full schedule identity even when different ranges share the same week columns. */
export function calendarScheduleKey(activity: ScheduledActivity): string {
  return JSON.stringify([activity.date_str, activity.end_date_str || activity.date_str,
    activity.start_time_iso?.split('T')[1] || activity.time_formatted,
    activity.end_time_iso?.split('T')[1] || activity.time_formatted]);
}

export function groupCalendarSegments<T extends { activity: ScheduledActivity }>(segments: T[]) {
  const groups = new Map<string, { key: string; segment: T; activities: T['activity'][] }>();
  for (const segment of segments) {
    const key = calendarScheduleKey(segment.activity);
    const group = groups.get(key);
    if (group) group.activities.push(segment.activity);
    else groups.set(key, { key, segment, activities: [segment.activity] });
  }
  return [...groups.values()];
}

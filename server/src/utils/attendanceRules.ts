import { db } from "../db/schema";

/**
 * NAMED ATTENDANCE CONSTANTS
 */
export const BIBLE_STUDY_EXCLUDE_EXCUSED_FROM_DENOMINATOR = true;
export const DEFAULT_ATTENDANCE_WINDOW_WEEKS = 12;
export const DEFAULT_CONSECUTIVE_ABSENCE_THRESHOLD = 3;

export interface ServiceRecordItem {
  id: number;
  service_date: string; // YYYY-MM-DD
  service_type: "sunday_service" | "special_service";
  title: string;
  status: "held" | "cancelled";
  notes?: string | null;
  check_in_count: number;
  is_recorded: boolean; // True if status === 'held' AND check_in_count > 0
}

export interface MonthlyAttendanceItem {
  month_num: number;
  month_name: string;
  present: number;
  absent: number;
  excused: number;
  total_sundays_in_month: number;
  elapsed_sundays: number;
  is_future: boolean;
}

export interface AttendanceRecordItem {
  id: number;
  checked_in_at: string;
  date_str: string;
  time_str: string;
  status: "present" | "absent" | "excused";
  notes?: string | null;
  security_code?: string | null;
  checked_in_by_name?: string | null;
  ministry_name?: string | null;
  ministry_color?: string | null;
}

export interface BaptismMilestoneTracker {
  is_baptized: boolean;
  baptism_status: string; // 'not_baptized' | 'candidate' | 'scheduled' | 'baptized'
  baptism_date?: string | null;
  baptism_notes?: string | null;
  is_eligible_for_ceremony: boolean;
  should_alert: boolean;
  alert_reason?: string | null;
}

export interface AttendanceSummaryMetrics {
  attended: number;
  missed: number; // Unlogged elapsed Sundays
  absent: number; // Explicitly logged absent
  excused: number; // Explicitly logged excused
  unrecorded_services_count: number;
  total_held_services: number; // Elapsed Sundays in window
  attendance_rate_percentage: number | null; // Attended / (Elapsed - Excused) * 100
  consistency_rate_percentage: number | null; // Attended / (Attended + Absent) * 100
  current_streak: number;
  longest_streak: number;
  last_attended_date: string | null;
}

export interface EventAttendanceSummaryMetrics {
  attended: number;
  total_events: number;
  last_attended_date: string | null;
  events_list: { id: number; title: string; event_date: string; attended_at: string }[];
}

export interface MemberComprehensiveAttendanceSummary {
  member_id: number;
  from_date: string;
  to_date: string;
  sunday_service: AttendanceSummaryMetrics;
  bible_study: AttendanceSummaryMetrics;
  events: EventAttendanceSummaryMetrics;
  overall_attendance_rate: number | null;
  consistency_score: number | null;
  consistency_tier: "Consistent Regular" | "Regular Attendee" | "Developing Habit" | "Needs Encouragement" | "Inactive / Disengaged" | "No Data";
  monthly_breakdown: MonthlyAttendanceItem[];
  records: AttendanceRecordItem[];
  baptism_tracker: BaptismMilestoneTracker;
}

/**
 * Returns list of calendar Sundays strictly between fromDate and min(toDate, todayStr)
 */
export function getElapsedCalendarSundays(fromDate: string, toDate: string, todayStr: string): string[] {
  const effectiveEnd = toDate < todayStr ? toDate : todayStr;
  if (fromDate > effectiveEnd) return [];

  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ey, em, ed] = effectiveEnd.split("-").map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ey, em - 1, ed);

  const sundays: string[] = [];
  const day = cur.getDay();
  const diff = day === 0 ? 0 : (7 - day);
  cur.setDate(cur.getDate() + diff);

  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    sundays.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 7);
  }
  return sundays;
}

export function getConsistencyTier(score: number | null, streak: number = 0): "Consistent Regular" | "Regular Attendee" | "Developing Habit" | "Needs Encouragement" | "Inactive / Disengaged" | "No Data" {
  if (score === null) return "No Data";
  if (score >= 80 && streak >= 3) return "Consistent Regular";
  if (score >= 70) return "Regular Attendee";
  if (score >= 50) return "Developing Habit";
  if (score >= 25) return "Needs Encouragement";
  return "Inactive / Disengaged";
}

/**
 * Auto-generates Sunday Service calendar entries for the past N weeks and future M weeks
 */
export async function autoGenerateSundayServices(
  weeksBack = 12,
  weeksAhead = 12,
  userId: number | null = null
): Promise<number> {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const [y, m, d] = todayStr.split("-").map(Number);
  const base = new Date(y, m - 1, d);

  // Find latest Sunday
  const dayOfWeek = base.getDay(); // 0 = Sunday
  const diffToSunday = dayOfWeek === 0 ? 0 : -dayOfWeek;
  const currentSunday = new Date(base);
  currentSunday.setDate(base.getDate() + diffToSunday);

  const sundayDates: string[] = [];

  // Generate past sundays
  for (let i = weeksBack; i >= 1; i--) {
    const s = new Date(currentSunday);
    s.setDate(currentSunday.getDate() - i * 7);
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(s);
    sundayDates.push(dateStr);
  }

  // Current Sunday
  sundayDates.push(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(currentSunday));

  // Future sundays
  for (let i = 1; i <= weeksAhead; i++) {
    const s = new Date(currentSunday);
    s.setDate(currentSunday.getDate() + i * 7);
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(s);
    sundayDates.push(dateStr);
  }

  let insertedCount = 0;
  if (sundayDates.length > 0) {
    await db.transaction(async (client) => {
      for (const sDate of sundayDates) {
        const res = await client.query(`
          INSERT INTO services (service_date, service_type, title, status, notes, created_by)
          VALUES ($1, 'sunday_service', 'Sunday Worship Service', 'held', '', $2)
          ON CONFLICT (service_date, service_type) DO NOTHING
        `, [sDate, userId]);
        if ((res.rowCount || 0) > 0) insertedCount += res.rowCount || 0;
      }
    });
  }

  return insertedCount;
}

/**
 * Get all services in a date range with check-in count and recorded status
 */
export async function getServicesWithRecordedStatus(
  fromDate: string,
  toDate: string
): Promise<ServiceRecordItem[]> {
  const rows = await db.all<any>(`
    SELECT
      s.id,
      to_char(s.service_date, 'YYYY-MM-DD') AS service_date,
      s.service_type,
      s.title,
      s.status,
      s.notes,
      COUNT(a.id)::INT AS check_in_count
    FROM services s
    LEFT JOIN attendance a
      ON (a.checked_in_at AT TIME ZONE 'Asia/Manila')::DATE = s.service_date
    WHERE s.service_date >= $1 AND s.service_date <= $2
    GROUP BY s.id, s.service_date, s.service_type, s.title, s.status, s.notes
    ORDER BY s.service_date DESC, s.service_type ASC
  `, [fromDate, toDate]);

  return rows.map((r) => ({
    id: r.id,
    service_date: r.service_date,
    service_type: r.service_type,
    title: r.title,
    status: r.status,
    notes: r.notes,
    check_in_count: r.check_in_count || 0,
    is_recorded: r.status === "held" && (r.check_in_count || 0) > 0
  }));
}

/**
 * Computes per-member attendance history, rates, and streaks (Single Source of Truth)
 */
export async function computeMemberAttendanceSummary(
  memberId: number,
  fromDate: string,
  toDate: string
): Promise<MemberComprehensiveAttendanceSummary> {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

  // 1. Fetch Member Info (for baptism data)
  const member = await db.get(`
    SELECT id, first_name, last_name, birthdate, is_baptized, baptism_status, baptism_date, baptism_notes
    FROM members
    WHERE id = $1
  `, [memberId]);

  // 2. Fetch all Sunday Attendance rows for this member in the window
  const attendanceRows = await db.all<any>(`
    SELECT
      a.id,
      a.member_id,
      a.ministry_id,
      a.event_id,
      to_char(a.checked_in_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS') AS checked_in_at,
      to_char((a.checked_in_at AT TIME ZONE 'Asia/Manila')::DATE, 'YYYY-MM-DD') AS date_str,
      to_char(a.checked_in_at AT TIME ZONE 'Asia/Manila', 'HH12:MI AM') AS time_str,
      a.security_code,
      a.notes,
      min.name AS ministry_name,
      min.color AS ministry_color,
      u.name AS checked_in_by_name,
      CASE
        WHEN a.notes ILIKE '%[ABSENT]%' THEN 'absent'
        WHEN a.notes ILIKE '%[EXCUSED]%' THEN 'excused'
        ELSE 'present'
      END AS status
    FROM attendance a
    LEFT JOIN ministries min ON a.ministry_id = min.id
    LEFT JOIN users u ON a.checked_in_by = u.id
    WHERE a.member_id = $1
      AND (a.checked_in_at AT TIME ZONE 'Asia/Manila')::DATE >= $2
      AND (a.checked_in_at AT TIME ZONE 'Asia/Manila')::DATE <= $3
    ORDER BY a.checked_in_at DESC
  `, [memberId, fromDate, toDate]);

  const recordsList: AttendanceRecordItem[] = attendanceRows.map((r: any) => ({
    id: r.id,
    checked_in_at: r.checked_in_at,
    date_str: r.date_str,
    time_str: r.time_str,
    status: r.status as "present" | "absent" | "excused",
    notes: r.notes,
    security_code: r.security_code,
    checked_in_by_name: r.checked_in_by_name,
    ministry_name: r.ministry_name,
    ministry_color: r.ministry_color
  }));

  // Map of records by date (if multiple, present takes precedence)
  const recordsByDate = new Map<string, { status: "present" | "absent" | "excused"; notes?: string }>();
  for (const r of attendanceRows) {
    const existing = recordsByDate.get(r.date_str);
    if (!existing || r.status === "present" || (r.status === "excused" && existing.status === "absent")) {
      recordsByDate.set(r.date_str, { status: r.status, notes: r.notes });
    }
  }

  // 3. Compute elapsed Sundays strictly up to today
  const elapsedSundays = getElapsedCalendarSundays(fromDate, toDate, todayStr);

  let sundayAttended = 0;
  let sundayAbsent = 0;
  let sundayExcused = 0;
  let sundayMissed = 0;
  let lastAttendedSundayDate: string | null = null;
  const sundayAttendanceFlags: boolean[] = [];

  for (const sDate of elapsedSundays) {
    const rec = recordsByDate.get(sDate);
    if (rec) {
      if (rec.status === "present") {
        sundayAttended++;
        lastAttendedSundayDate = sDate;
        sundayAttendanceFlags.push(true);
      } else if (rec.status === "excused") {
        sundayExcused++;
        sundayAttendanceFlags.push(false);
      } else {
        sundayAbsent++;
        sundayAttendanceFlags.push(false);
      }
    } else {
      sundayMissed++;
      sundayAttendanceFlags.push(false);
    }
  }

  // Denominators
  const netSundays = Math.max(0, elapsedSundays.length - sundayExcused);
  const sundayRate = netSundays > 0 ? Math.round((sundayAttended / netSundays) * 100) : null;
  const loggedRollCalls = sundayAttended + sundayAbsent;
  const consistencyRate = loggedRollCalls > 0 ? Math.round((sundayAttended / loggedRollCalls) * 100) : null;

  // Streaks for Sunday
  let currentSundayStreak = 0;
  let longestSundayStreak = 0;
  let tempStreak = 0;

  for (const attended of sundayAttendanceFlags) {
    if (attended) {
      tempStreak++;
      if (tempStreak > longestSundayStreak) longestSundayStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }
  for (let i = sundayAttendanceFlags.length - 1; i >= 0; i--) {
    if (sundayAttendanceFlags[i]) {
      currentSundayStreak++;
    } else {
      break;
    }
  }

  // 4. Bible Study calculation
  const bsSessions = await db.all<any>(`
    SELECT
      to_char(s.session_date, 'YYYY-MM-DD') AS session_date,
      a.status
    FROM bible_study_sessions s
    JOIN bible_study_members bsm ON s.group_id = bsm.group_id AND bsm.member_id = $1
    LEFT JOIN bible_study_attendance a
      ON s.group_id = a.group_id AND s.session_date = a.session_date AND a.member_id = $1
    WHERE s.session_date >= $2 AND s.session_date <= $3
    ORDER BY s.session_date ASC
  `, [memberId, fromDate, toDate]);

  let bsPresent = 0;
  let bsAbsent = 0;
  let bsExcused = 0;
  let lastAttendedBsDate: string | null = null;
  const bsAttendanceFlags: boolean[] = [];

  for (const b of bsSessions) {
    const st = b.status ? String(b.status).toLowerCase() : "absent";
    if (st === "present") {
      bsPresent++;
      lastAttendedBsDate = b.session_date;
      bsAttendanceFlags.push(true);
    } else if (st === "excused") {
      bsExcused++;
      bsAttendanceFlags.push(false);
    } else {
      bsAbsent++;
      bsAttendanceFlags.push(false);
    }
  }

  const bsDenominator = bsPresent + bsAbsent;
  const bsRate = bsSessions.length > 0 && bsDenominator > 0 ? Math.round((bsPresent / bsDenominator) * 100) : null;

  let currentBsStreak = 0;
  let longestBsStreak = 0;
  let tempBsStreak = 0;

  for (const attended of bsAttendanceFlags) {
    if (attended) {
      tempBsStreak++;
      if (tempBsStreak > longestBsStreak) longestBsStreak = tempBsStreak;
    } else {
      tempBsStreak = 0;
    }
  }
  for (let i = bsAttendanceFlags.length - 1; i >= 0; i--) {
    if (bsAttendanceFlags[i]) {
      currentBsStreak++;
    } else {
      break;
    }
  }

  // 5. Event attendance calculation
  const totalEventsInWindow = await db.get<{ count: string | number }>(`
    SELECT COUNT(*)::INT AS count
    FROM events
    WHERE (start_time AT TIME ZONE 'Asia/Manila')::DATE >= $1
      AND (start_time AT TIME ZONE 'Asia/Manila')::DATE <= $2
  `, [fromDate, toDate]);

  const memberEventAttendance = await db.all<{ id: number; title: string; event_date: string; attended_at: string }>(`
    SELECT DISTINCT
      e.id,
      e.title,
      to_char((COALESCE(e.start_time, v.recorded_at) AT TIME ZONE 'Asia/Manila')::DATE, 'YYYY-MM-DD') AS event_date,
      to_char(v.recorded_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI:SS') AS attended_at
    FROM attendance_log v
    JOIN events e ON v.event_id = e.id
    WHERE v.member_id = $1
      AND v.log_type = 'event'
      AND v.status = 'present'
      AND v.log_date >= $2
      AND v.log_date <= $3
    ORDER BY event_date DESC
  `, [memberId, fromDate, toDate]);

  const lastAttendedEventDate = memberEventAttendance.length > 0 ? memberEventAttendance[0].event_date : null;

  // 6. Monthly Breakdown (12 Months of target year)
  const targetYear = parseInt(toDate.split("-")[0], 10) || new Date().getFullYear();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const monthlyBreakdown: MonthlyAttendanceItem[] = [];
  for (let mIdx = 0; mIdx < 12; mIdx++) {
    const mNum = mIdx + 1;
    const mStr = String(mNum).padStart(2, "0");
    const mStart = `${targetYear}-${mStr}-01`;
    const lastDayNum = new Date(targetYear, mNum, 0).getDate();
    const mEnd = `${targetYear}-${mStr}-${String(lastDayNum).padStart(2, "0")}`;

    const isFuture = mStart > todayStr;
    const mElapsedSundays = getElapsedCalendarSundays(mStart, mEnd, todayStr);
    const mAllSundays = getElapsedCalendarSundays(mStart, mEnd, mEnd);

    let mPresent = 0;
    let mAbsent = 0;
    let mExcused = 0;

    for (const r of attendanceRows) {
      if (r.date_str >= mStart && r.date_str <= mEnd) {
        if (r.status === "present") mPresent++;
        else if (r.status === "absent") mAbsent++;
        else if (r.status === "excused") mExcused++;
      }
    }

    monthlyBreakdown.push({
      month_num: mNum,
      month_name: monthNames[mIdx],
      present: mPresent,
      absent: mAbsent,
      excused: mExcused,
      total_sundays_in_month: mAllSundays.length,
      elapsed_sundays: mElapsedSundays.length,
      is_future: isFuture
    });
  }

  // 7. Baptism Milestone Tracker
  const isCandidate = member?.baptism_status === "candidate" || member?.baptism_status === "scheduled";
  const isBaptized = Boolean(member?.is_baptized || member?.baptism_status === "baptized");
  const isAttendanceQualified = !isBaptized && (sundayAttended >= 10 || ((consistencyRate || 0) >= 65 && sundayAttended >= 6));
  const shouldAlertForBaptism = isCandidate || isAttendanceQualified;
  const alertReason = isCandidate
    ? "This member is scheduled or nominated for the Water Baptism Ceremony."
    : isAttendanceQualified
      ? "This member has demonstrated faithful Sunday attendance and qualifies for Water Baptism!"
      : null;

  const baptismTracker: BaptismMilestoneTracker = {
    is_baptized: isBaptized,
    baptism_status: member?.baptism_status || (isBaptized ? "baptized" : "not_baptized"),
    baptism_date: member?.baptism_date || null,
    baptism_notes: member?.baptism_notes || null,
    is_eligible_for_ceremony: isAttendanceQualified,
    should_alert: shouldAlertForBaptism,
    alert_reason: alertReason
  };

  // 8. Consistency Tier & Overall Score
  const consistencyScore = sundayRate !== null ? sundayRate : (bsRate !== null ? bsRate : null);
  const consistencyTier = getConsistencyTier(consistencyScore, currentSundayStreak);

  return {
    member_id: memberId,
    from_date: fromDate,
    to_date: toDate,
    sunday_service: {
      attended: sundayAttended,
      missed: sundayMissed,
      absent: sundayAbsent,
      excused: sundayExcused,
      unrecorded_services_count: 0,
      total_held_services: elapsedSundays.length,
      attendance_rate_percentage: sundayRate,
      consistency_rate_percentage: consistencyRate,
      current_streak: currentSundayStreak,
      longest_streak: longestSundayStreak,
      last_attended_date: lastAttendedSundayDate
    },
    bible_study: {
      attended: bsPresent,
      missed: bsAbsent,
      absent: bsAbsent,
      excused: bsExcused,
      unrecorded_services_count: 0,
      total_held_services: bsSessions.length,
      attendance_rate_percentage: bsRate,
      consistency_rate_percentage: bsDenominator > 0 ? Math.round((bsPresent / bsDenominator) * 100) : null,
      current_streak: currentBsStreak,
      longest_streak: longestBsStreak,
      last_attended_date: lastAttendedBsDate
    },
    events: {
      attended: memberEventAttendance.length,
      total_events: Number(totalEventsInWindow?.count || 0),
      last_attended_date: lastAttendedEventDate,
      events_list: memberEventAttendance
    },
    overall_attendance_rate: consistencyScore,
    consistency_score: consistencyScore,
    consistency_tier: consistencyTier,
    monthly_breakdown: monthlyBreakdown,
    records: recordsList,
    baptism_tracker: baptismTracker
  };
}

import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";

const router = Router();

// List events
router.get("/", async (req: Request, res: Response) => {
  try {
    const { ministry_id, upcoming, page, limit, search } = req.query;

    let whereClause = " WHERE 1=1";
    const params: any[] = [];

    if (ministry_id) {
      params.push(ministry_id);
      whereClause += ` AND (e.ministry_id = $${params.length} OR e.ministry_id IS NULL)`;
    }

    if (upcoming === "true") {
      whereClause += " AND e.start_time >= CURRENT_TIMESTAMP";
    }

    if (search && typeof search === "string" && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClause += ` AND (e.title ILIKE $${params.length} OR e.description ILIKE $${params.length} OR e.location ILIKE $${params.length})`;
    }

    const isPaginated = page !== undefined || limit !== undefined;
    let totalCount = 0;
    const curPage = Math.max(1, page ? parseInt(String(page), 10) : 1);
    const curLimit = Math.min(100, Math.max(1, limit ? parseInt(String(limit), 10) : 20));

    if (isPaginated) {
      const countRes = await db.get<{ total: string | number }>(`
        SELECT COUNT(*) as total FROM events e ${whereClause}
      `, params);
      totalCount = parseInt(String(countRes?.total || 0), 10);
    }

    let query = `
      SELECT e.id, e.title, e.description, e.start_time, e.end_time, e.location, 
             e.ministry_id, e.created_by, e.created_at,
             min.name as ministry_name, min.color as ministry_color,
             u.name as creator_name,
             (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND status = 'registered') as rsvp_count
      FROM events e
      LEFT JOIN ministries min ON e.ministry_id = min.id
      LEFT JOIN users u ON e.created_by = u.id
      ${whereClause}
      ORDER BY e.start_time ASC
    `;

    let events: any[] = [];
    if (isPaginated) {
      const offset = (curPage - 1) * curLimit;
      const paginatedParams = [...params, curLimit, offset];
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      events = await db.all(query, paginatedParams);
    } else {
      events = await db.all(query, params);
    }

    const formatted = events.map(e => ({
      ...e,
      rsvp_count: Number(e.rsvp_count || 0)
    }));

    if (isPaginated) {
      res.json({
        data: formatted,
        pagination: {
          total: totalCount,
          page: curPage,
          limit: curLimit,
          totalPages: Math.ceil(totalCount / curLimit) || 1
        }
      });
    } else {
      res.json(formatted);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function computeProjectedSundayDate(year: number, month: number, weekPattern: string): { dateStr: string; day: number; formatted: string } {
  // month is 1-12
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const sundaysInMonth: Date[] = [];
  const d = new Date(firstDayOfMonth);
  while (d.getMonth() === month - 1) {
    if (d.getDay() === 0) { // Sunday
      sundaysInMonth.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }

  let targetSunday = sundaysInMonth[0] || firstDayOfMonth;
  if (weekPattern === "1st_sunday" && sundaysInMonth.length > 0) targetSunday = sundaysInMonth[0];
  else if (weekPattern === "2nd_sunday" && sundaysInMonth.length > 1) targetSunday = sundaysInMonth[1];
  else if (weekPattern === "3rd_sunday" && sundaysInMonth.length > 2) targetSunday = sundaysInMonth[2];
  else if (weekPattern === "4th_sunday" && sundaysInMonth.length > 3) targetSunday = sundaysInMonth[3];
  else if (weekPattern === "last_sunday" && sundaysInMonth.length > 0) targetSunday = sundaysInMonth[sundaysInMonth.length - 1];

  const y = targetSunday.getFullYear();
  const m = String(targetSunday.getMonth() + 1).padStart(2, "0");
  const day = String(targetSunday.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${day}`;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const formatted = `${monthNames[targetSunday.getMonth()]} ${targetSunday.getDate()}, ${y}`;

  return { dateStr, day: targetSunday.getDate(), formatted };
}

// Get Annual Recurring Sunday Events Cycle
router.get("/recurring-sunday-cycle", async (req: Request, res: Response) => {
  try {
    const targetYear = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();
    const { ministry_id } = req.query;

    let query = `
      SELECT r.*, min.name as db_ministry_name, min.color as db_ministry_color
      FROM recurring_sunday_events r
      LEFT JOIN ministries min ON r.target_ministry_id = min.id
      WHERE r.is_active = TRUE
    `;
    const params: any[] = [];
    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND (r.target_ministry_id = $${params.length} OR r.target_ministry_id IS NULL)`;
    }
    query += " ORDER BY r.month ASC, r.id ASC";

    const rows = await db.all(query, params);

    // Also fetch scheduled regular events for this year to see which recurring events are already officially synced
    const scheduledEvents = await db.all(`
      SELECT id, title, start_time, location
      FROM events
      WHERE EXTRACT(YEAR FROM start_time) = $1
    `, [targetYear]).catch(() => []);

    const todayStr = new Date().toISOString().split("T")[0];

    const enriched = rows.map(r => {
      const projection = computeProjectedSundayDate(targetYear, r.month, r.week_pattern || "1st_sunday");
      const matchedScheduled = scheduledEvents.find(se => {
        const seDate = typeof se.start_time === "string" ? se.start_time.split("T")[0] : new Date(se.start_time).toISOString().split("T")[0];
        return seDate === projection.dateStr || se.title.toLowerCase().includes(r.title.toLowerCase().slice(0, 15));
      });

      const isPast = projection.dateStr < todayStr;
      const isToday = projection.dateStr === todayStr;

      return {
        ...r,
        target_year: targetYear,
        projected_date: projection.dateStr,
        projected_day: projection.day,
        projected_formatted: projection.formatted,
        is_past: isPast,
        is_today: isToday,
        is_synced_to_calendar: !!matchedScheduled,
        synced_event_id: matchedScheduled?.id || null
      };
    });

    res.json({
      year: targetYear,
      available_years: [targetYear - 1, targetYear, targetYear + 1, targetYear + 2],
      events: enriched,
      total_annual_events: enriched.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new recurring Sunday event definition
router.post("/recurring-sunday-cycle", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      theme_tagline,
      description,
      month,
      week_pattern = "1st_sunday",
      target_ministry_id,
      target_ministry_name,
      color = "#2C3968",
      icon = "Sparkles",
      liturgical_notes,
      program_highlights
    } = req.body;

    if (!title || !title.trim() || !month) {
      return res.status(400).json({ error: "Title and month are required" });
    }

    const monthNum = Number(month);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: "Month must be between 1 and 12" });
    }

    const existing = await db.get(
      "SELECT id FROM recurring_sunday_events WHERE LOWER(title) = LOWER($1) AND month = $2",
      [title.trim(), monthNum]
    );
    if (existing) {
      return res.status(400).json({ error: "A recurring celebration with this title already exists in this month" });
    }

    const result = await db.run(`
      INSERT INTO recurring_sunday_events (
        title, theme_tagline, description, month, week_pattern,
        target_ministry_id, target_ministry_name, color, icon,
        liturgical_notes, program_highlights, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
      RETURNING id
    `, [
      title.trim(),
      theme_tagline || null,
      description || null,
      monthNum,
      week_pattern,
      target_ministry_id || null,
      target_ministry_name || null,
      color,
      icon,
      liturgical_notes || null,
      program_highlights || null
    ]);

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user?.id || null, "CREATE", "recurring_sunday_events", newId, `Created recurring Sunday event: ${title}`);
    emitRealtimeEvent("events:changed", { action: "create_recurring_sunday", id: newId });

    res.status(201).json({ id: newId, message: "Recurring Sunday celebration created successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update recurring Sunday event
router.put("/recurring-sunday-cycle/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const {
      title,
      theme_tagline,
      description,
      month,
      week_pattern,
      target_ministry_id,
      target_ministry_name,
      color,
      icon,
      liturgical_notes,
      program_highlights,
      is_active
    } = req.body;

    await db.run(`
      UPDATE recurring_sunday_events
      SET title = COALESCE($1, title),
          theme_tagline = COALESCE($2, theme_tagline),
          description = COALESCE($3, description),
          month = COALESCE($4, month),
          week_pattern = COALESCE($5, week_pattern),
          target_ministry_id = $6,
          target_ministry_name = COALESCE($7, target_ministry_name),
          color = COALESCE($8, color),
          icon = COALESCE($9, icon),
          liturgical_notes = COALESCE($10, liturgical_notes),
          program_highlights = COALESCE($11, program_highlights),
          is_active = COALESCE($12, is_active)
      WHERE id = $13
    `, [
      title,
      theme_tagline,
      description,
      month ? Number(month) : null,
      week_pattern,
      target_ministry_id || null,
      target_ministry_name,
      color,
      icon,
      liturgical_notes,
      program_highlights,
      is_active !== undefined ? is_active : true,
      id
    ]);

    await logAuditAction(req.user?.id || null, "UPDATE", "recurring_sunday_events", id, `Updated recurring Sunday event #${id}`);
    emitRealtimeEvent("events:changed", { action: "update_recurring_sunday", id });

    res.json({ message: "Recurring Sunday event updated successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete recurring Sunday event
router.delete("/recurring-sunday-cycle/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.run("DELETE FROM recurring_sunday_events WHERE id = $1", [id]);
    await logAuditAction(req.user?.id || null, "DELETE", "recurring_sunday_events", id, `Deleted recurring Sunday event #${id}`);
    emitRealtimeEvent("events:changed", { action: "delete_recurring_sunday", id });

    res.json({ message: "Recurring Sunday celebration deleted successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync / Schedule a recurring Sunday event into the main Church Events calendar for a given year
router.post("/recurring-sunday-cycle/:id/sync-to-calendar", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { year = new Date().getFullYear(), start_time_str = "09:00", end_time_str = "12:00", location = "Main Worship Sanctuary" } = req.body;

    const recurring = await db.get("SELECT * FROM recurring_sunday_events WHERE id = $1", [id]);
    if (!recurring) {
      return res.status(404).json({ error: "Recurring Sunday event not found" });
    }

    const projection = computeProjectedSundayDate(year, recurring.month, recurring.week_pattern || "1st_sunday");
    const startTimeISO = `${projection.dateStr}T${start_time_str}:00`;
    const endTimeISO = `${projection.dateStr}T${end_time_str}:00`;

    const result = await db.run(`
      INSERT INTO events (title, description, start_time, end_time, location, ministry_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      recurring.title,
      `${recurring.theme_tagline ? `${recurring.theme_tagline} — ` : ""}${recurring.description || ""}`,
      startTimeISO,
      endTimeISO,
      location,
      recurring.target_ministry_id || null,
      req.user?.id || 1
    ]);

    const newEventId = result.lastInsertRowid;
    await logAuditAction(req.user?.id || null, "CREATE", "events", newEventId, `Scheduled annual celebration '${recurring.title}' into Church Calendar on ${projection.formatted}`);
    emitRealtimeEvent("events:changed", { action: "sync_recurring_to_calendar", id: newEventId });

    res.json({
      success: true,
      event_id: newEventId,
      projected_date: projection.dateStr,
      formatted_date: projection.formatted,
      message: `Successfully scheduled '${recurring.title}' on ${projection.formatted}!`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single event details with registrations
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const event = await db.get(`
      SELECT e.*, min.name as ministry_name, min.color as ministry_color, u.name as creator_name
      FROM events e
      LEFT JOIN ministries min ON e.ministry_id = min.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = $1
    `, [req.params.id]);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const registrations = await db.all(`
      SELECT er.*, m.first_name, m.last_name, m.contact_email, m.contact_phone
      FROM event_registrations er
      JOIN members m ON er.member_id = m.id
      WHERE er.event_id = $1
      ORDER BY er.created_at DESC
    `, [event.id]);

    res.json({
      ...event,
      registrations
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create event
router.post("/", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const { ministry_id, title, description, start_time, end_time, location } = req.body;

    if (!title || !title.trim() || !start_time || !end_time) {
      return res.status(400).json({ error: "Title, start time, and end time are required" });
    }

    if (new Date(end_time).getTime() < new Date(start_time).getTime()) {
      return res.status(400).json({ error: "End time cannot be earlier than start time" });
    }

    const existing = await db.get(
      "SELECT id FROM events WHERE LOWER(title) = LOWER($1) AND DATE(start_time) = DATE($2)",
      [title.trim(), start_time]
    );
    if (existing) {
      return res.status(400).json({ error: "An event with this title on the same date already exists" });
    }

    const result = await db.run(`
      INSERT INTO events (ministry_id, title, description, start_time, end_time, location, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      ministry_id || null,
      title.trim(),
      description || null,
      start_time,
      end_time,
      location || null,
      req.user!.id
    ]);

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user!.id, "CREATE", "events", newId, `Created event: ${title}`);

    emitRealtimeEvent("events:changed", { action: "create", id: newId });

    res.status(201).json({ id: newId, message: "Event created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// RSVP / Register for event
router.post("/:id/rsvp", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const eventId = req.params.id;
    const { member_id, status = "registered" } = req.body;

    // If member_id isn't provided, try to find linked member from current user
    let targetMemberId = member_id;
    if (!targetMemberId) {
      const linkedMember = await db.get("SELECT id FROM members WHERE user_id = $1", [req.user!.id]);
      if (linkedMember) {
        targetMemberId = linkedMember.id;
      } else {
        return res.status(400).json({ error: "member_id is required" });
      }
    }

    const existing = await db.get(`
      SELECT * FROM event_registrations WHERE event_id = $1 AND member_id = $2
    `, [eventId, targetMemberId]);

    if (existing) {
      await db.run(`
        UPDATE event_registrations SET status = $1 WHERE id = $2
      `, [status, existing.id]);

      emitRealtimeEvent("events:changed", { action: "rsvp", id: Number(eventId) });

      return res.json({ message: "RSVP updated", status });
    }

    await db.run(`
      INSERT INTO event_registrations (event_id, member_id, status)
      VALUES ($1, $2, $3)
    `, [eventId, targetMemberId, status]);

    emitRealtimeEvent("events:changed", { action: "rsvp", id: Number(eventId) });

    res.status(201).json({ message: "RSVP confirmed successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Event Attendance Roster & Check-In status
router.get("/:id/attendance-roster", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const eventId = Number(req.params.id);
    const event = await db.get("SELECT * FROM events WHERE id = $1", [eventId]);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const attendees = await db.all(`
      SELECT
        m.id AS member_id,
        m.first_name,
        m.last_name,
        m.contact_phone,
        m.contact_email,
        m.ministry_id,
        COALESCE(min.name, 'Unassigned') AS ministry_name,
        min.color AS ministry_color,
        CASE
          WHEN att.id IS NOT NULL AND att.notes ILIKE '%[ABSENT]%' THEN 'absent'
          WHEN att.id IS NOT NULL AND att.notes ILIKE '%[EXCUSED]%' THEN 'excused'
          WHEN att.id IS NOT NULL OR er.status = 'attended' THEN 'attended'
          WHEN er.status = 'absent' THEN 'absent'
          WHEN er.status = 'excused' THEN 'excused'
          WHEN er.status = 'registered' THEN 'registered'
          ELSE 'unregistered'
        END AS status,
        att.notes AS attendance_notes,
        er.created_at AS registered_at,
        att.checked_in_at,
        att.id AS attendance_id
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN event_registrations er ON er.event_id = $1 AND er.member_id = m.id
      LEFT JOIN attendance att ON att.event_id = $1 AND att.member_id = m.id
      WHERE m.status = 'active'
      ORDER BY
        CASE
          WHEN att.id IS NOT NULL AND (att.notes ILIKE '%[ABSENT]%' OR att.notes ILIKE '%[EXCUSED]%') THEN 2
          WHEN att.id IS NOT NULL OR er.status = 'attended' THEN 1
          WHEN er.status = 'registered' THEN 3
          ELSE 4
        END ASC,
        LOWER(m.first_name) ASC,
        LOWER(m.last_name) ASC
    `, [eventId]);

    const totalAttended = attendees.filter(a => a.status === 'attended').length;
    const totalAbsent = attendees.filter(a => a.status === 'absent').length;
    const totalExcused = attendees.filter(a => a.status === 'excused').length;
    const totalRegistered = attendees.filter(a => a.status === 'registered').length;

    res.json({
      event: {
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        location: event.location
      },
      summary: {
        total_registered: totalRegistered,
        total_attended: totalAttended,
        total_absent: totalAbsent,
        total_excused: totalExcused,
        total_active_members: attendees.length
      },
      attendees
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mark one or more members as Present / Absent / Excused / Registered for an event
router.post("/:id/attendance/mark", authMiddleware, requireRoles("Admin", "Coordinator", "Leader", "Volunteer"), async (req: AuthRequest, res: Response) => {
  try {
    const eventId = Number(req.params.id);
    const { member_ids, member_id, status = "attended", notes, reason } = req.body;

    const event = await db.get("SELECT * FROM events WHERE id = $1", [eventId]);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const ids: number[] = Array.isArray(member_ids)
      ? member_ids.map(Number).filter(id => !isNaN(id) && id > 0)
      : (member_id ? [Number(member_id)] : []);

    if (ids.length === 0) {
      return res.status(400).json({ error: "member_id or member_ids array is required" });
    }

    const noteReason = reason || notes;

    for (const mId of ids) {
      const member = await db.get("SELECT * FROM members WHERE id = $1", [mId]);
      if (!member) continue;

      if (status === "attended" || status === "present") {
        // 1. Update/Insert in event_registrations
        await db.run(`
          INSERT INTO event_registrations (event_id, member_id, status)
          VALUES ($1, $2, 'attended')
          ON CONFLICT (event_id, member_id)
          DO UPDATE SET status = 'attended'
        `, [eventId, mId]);

        // 2. Ensure record exists in attendance table
        const existingAtt = await db.get("SELECT id FROM attendance WHERE event_id = $1 AND member_id = $2", [eventId, mId]);
        if (existingAtt) {
          await db.run(`
            UPDATE attendance
            SET notes = $1,
                checked_in_by = $2,
                checked_in_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [noteReason || `Event attendance for ${event.title}`, req.user?.id || null, existingAtt.id]);
        } else {
          await db.run(`
            INSERT INTO attendance (member_id, ministry_id, event_id, checked_in_at, checked_in_by, notes)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
          `, [
            mId,
            member.ministry_id || 1,
            eventId,
            req.user?.id || null,
            noteReason || `Event attendance for ${event.title}`
          ]);
        }
      } else if (status === "absent") {
        await db.run(`
          INSERT INTO event_registrations (event_id, member_id, status)
          VALUES ($1, $2, 'absent')
          ON CONFLICT (event_id, member_id)
          DO UPDATE SET status = 'absent'
        `, [eventId, mId]);

        const absentNotes = noteReason
          ? (noteReason.includes("[ABSENT]") ? noteReason : `[ABSENT] ${noteReason}`)
          : `[ABSENT] Absent from event ${event.title}`;

        const existingAtt = await db.get("SELECT id FROM attendance WHERE event_id = $1 AND member_id = $2", [eventId, mId]);
        if (existingAtt) {
          await db.run(`
            UPDATE attendance
            SET notes = $1,
                checked_in_by = $2,
                checked_in_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [absentNotes, req.user?.id || null, existingAtt.id]);
        } else {
          await db.run(`
            INSERT INTO attendance (member_id, ministry_id, event_id, checked_in_at, checked_in_by, notes)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
          `, [
            mId,
            member.ministry_id || 1,
            eventId,
            req.user?.id || null,
            absentNotes
          ]);
        }
      } else if (status === "excused") {
        await db.run(`
          INSERT INTO event_registrations (event_id, member_id, status)
          VALUES ($1, $2, 'excused')
          ON CONFLICT (event_id, member_id)
          DO UPDATE SET status = 'excused'
        `, [eventId, mId]);

        const excusedNotes = noteReason
          ? (noteReason.includes("[EXCUSED]") ? noteReason : `[EXCUSED] ${noteReason}`)
          : `[EXCUSED] Excused from event ${event.title}`;

        const existingAtt = await db.get("SELECT id FROM attendance WHERE event_id = $1 AND member_id = $2", [eventId, mId]);
        if (existingAtt) {
          await db.run(`
            UPDATE attendance
            SET notes = $1,
                checked_in_by = $2,
                checked_in_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [excusedNotes, req.user?.id || null, existingAtt.id]);
        } else {
          await db.run(`
            INSERT INTO attendance (member_id, ministry_id, event_id, checked_in_at, checked_in_by, notes)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
          `, [
            mId,
            member.ministry_id || 1,
            eventId,
            req.user?.id || null,
            excusedNotes
          ]);
        }
      } else if (status === "registered") {
        await db.run(`
          INSERT INTO event_registrations (event_id, member_id, status)
          VALUES ($1, $2, 'registered')
          ON CONFLICT (event_id, member_id)
          DO UPDATE SET status = 'registered'
        `, [eventId, mId]);
        await db.run("DELETE FROM attendance WHERE event_id = $1 AND member_id = $2", [eventId, mId]);
      } else if (status === "unregistered") {
        await db.run("DELETE FROM event_registrations WHERE event_id = $1 AND member_id = $2", [eventId, mId]);
        await db.run("DELETE FROM attendance WHERE event_id = $1 AND member_id = $2", [eventId, mId]);
      }
    }

    await logAuditAction(
      req.user?.id || null,
      "UPDATE_ATTENDANCE",
      "events",
      eventId,
      `Marked ${ids.length} member(s) as '${status}' for event '${event.title}' (Member IDs: ${ids.join(", ")})`
    );

    emitRealtimeEvent("events:changed", { action: "attendance_mark", event_id: eventId, member_ids: ids });
    emitRealtimeEvent("attendance:new", { event_id: eventId, action: "event_attendance" });

    res.json({
      success: true,
      message: `Successfully updated attendance for ${ids.length} member(s)!`,
      count: ids.length,
      status
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch Mark Event Attendance (Fast bulk roll call: present vs absent / pending)
router.post("/:id/attendance/batch-mark", authMiddleware, requireRoles("Admin", "Coordinator", "Leader", "Volunteer"), async (req: AuthRequest, res: Response) => {
  try {
    const eventId = Number(req.params.id);
    const {
      present_ids = [],
      absent_ids = [],
      notes
    } = req.body;

    const event = await db.get("SELECT * FROM events WHERE id = $1", [eventId]);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    let markedPresentCount = 0;
    let markedAbsentCount = 0;

    // 1. Process Present IDs
    if (Array.isArray(present_ids) && present_ids.length > 0) {
      for (const mId of present_ids) {
        const member = await db.get("SELECT * FROM members WHERE id = $1", [mId]);
        if (!member) continue;

        // Upsert into event_registrations as 'attended'
        await db.run(`
          INSERT INTO event_registrations (event_id, member_id, status)
          VALUES ($1, $2, 'attended')
          ON CONFLICT (event_id, member_id)
          DO UPDATE SET status = 'attended'
        `, [eventId, mId]);

        // Upsert/Insert into attendance table
        const existingAtt = await db.get("SELECT id FROM attendance WHERE event_id = $1 AND member_id = $2", [eventId, mId]);
        if (existingAtt) {
          await db.run(`
            UPDATE attendance
            SET notes = $1,
                checked_in_by = $2,
                checked_in_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [notes || `Event attendance for ${event.title}`, req.user?.id || null, existingAtt.id]);
        } else {
          await db.run(`
            INSERT INTO attendance (member_id, ministry_id, event_id, checked_in_at, checked_in_by, notes)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
          `, [
            mId,
            member.ministry_id || 1,
            eventId,
            req.user?.id || null,
            notes || `Event attendance for ${event.title}`
          ]);
        }
        markedPresentCount++;
      }
    }

    // 2. Process Absent IDs (Mark as 'registered' / not attended, and remove from attendance table)
    if (Array.isArray(absent_ids) && absent_ids.length > 0) {
      for (const mId of absent_ids) {
        const member = await db.get("SELECT * FROM members WHERE id = $1", [mId]);
        if (!member) continue;

        // If registered, ensure status is 'registered'
        await db.run(`
          UPDATE event_registrations
          SET status = 'registered'
          WHERE event_id = $1 AND member_id = $2 AND status = 'attended'
        `, [eventId, mId]);

        // Remove from attendance table
        await db.run("DELETE FROM attendance WHERE event_id = $1 AND member_id = $2", [eventId, mId]);
        markedAbsentCount++;
      }
    }

    await logAuditAction(
      req.user?.id || null,
      "BATCH_UPDATE_ATTENDANCE",
      "events",
      eventId,
      `Batch roll call for event '${event.title}': ${markedPresentCount} Present, ${markedAbsentCount} Absent/Reset`
    );

    emitRealtimeEvent("events:changed", { action: "attendance_batch_mark", event_id: eventId });
    emitRealtimeEvent("attendance:new", { event_id: eventId, action: "event_attendance_batch" });

    res.json({
      success: true,
      message: `Batch roll call processed: ${markedPresentCount} Present, ${markedAbsentCount} Absent / Reset`,
      stats: {
        present: markedPresentCount,
        absent: markedAbsentCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update event
router.put("/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { ministry_id, title, description, start_time, end_time, location } = req.body;

    if (start_time && end_time && new Date(end_time).getTime() < new Date(start_time).getTime()) {
      return res.status(400).json({ error: "End time cannot be earlier than start time" });
    }

    await db.run(`
      UPDATE events
      SET ministry_id = $1,
          title = COALESCE($2, title),
          description = COALESCE($3, description),
          start_time = COALESCE($4, start_time),
          end_time = COALESCE($5, end_time),
          location = COALESCE($6, location)
      WHERE id = $7
    `, [
      ministry_id || null,
      title ? title.trim() : null,
      description,
      start_time,
      end_time,
      location,
      id
    ]);

    await logAuditAction(req.user!.id, "UPDATE", "events", id, `Updated event #${id}`);
    emitRealtimeEvent("events:changed", { action: "update", id });

    res.json({ message: "Event updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete event
router.delete("/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    await db.run("DELETE FROM events WHERE id = $1", [id]);
    await logAuditAction(req.user!.id, "DELETE", "events", Number(id), `Deleted event #${id}`);

    emitRealtimeEvent("events:changed", { action: "delete", id: Number(id) });

    res.json({ message: "Event deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

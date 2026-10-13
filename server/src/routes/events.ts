import {eventParticipation,markEventParticipant,markEventParticipants,closeEventAttendance,previewEventClose,setEventSundayReflection,ParticipationError} from '../services/eventParticipation';
import { isCalendarDate, parsePagination, validatePagination } from "../utils/pagination";
import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";

import { eventMinistryIdsSql, recurringMinistryIdsSql, parseEventMinistries, validateEventMinistries, saveEventMinistries } from '../utils/eventMinistries';
const router = Router();
async function requestedMinistries(req: AuthRequest, res: Response, recurring = false, existingId?: number) {
  try {
    let ids = parseEventMinistries(req.body, recurring);
    if (ids === undefined && existingId) {
      const current = await db.get(recurring
        ? `SELECT ${recurringMinistryIdsSql('r')} AS ministry_ids FROM recurring_sunday_events r WHERE id=$1`
        : `SELECT ${eventMinistryIdsSql('e')} AS ministry_ids FROM events e WHERE id=$1`, [existingId]);
      if (!current) { res.status(404).json({ error: 'Event not found.' }); return null; }
      ids = current.ministry_ids;
    }
    await validateEventMinistries(ids);
    return ids || [];
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Choose valid target ministries.' }); return null; }
}

// List events
router.get("/", validatePagination, async (req: Request, res: Response) => {
  try {
    const { ministry_id, upcoming, page, limit, search } = req.query;

    let whereClause = " WHERE 1=1";
    const params: any[] = [];

    if (ministry_id) {
      params.push(ministry_id);
      whereClause += ` AND (e.ministry_id IS NULL OR e.ministry_id = $${params.length} OR EXISTS (SELECT 1 FROM event_ministries em WHERE em.event_id=e.id AND em.enabled AND em.ministry_id=$${params.length}))`;
    }

    for (const key of ["from", "to"]) {
      if (req.query[key]) {
        if (!isCalendarDate(req.query[key])) return res.status(400).json({ error: "Choose valid calendar dates." });
        params.push(req.query[key]);
        whereClause += key === "from" ? ` AND COALESCE(e.end_time, e.start_time) >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Manila')` : ` AND e.start_time < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Manila')`;
      }
    }
    if (upcoming === "true") {
      whereClause += " AND e.start_time >= CURRENT_TIMESTAMP";
    }

    if (search && typeof search === "string" && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClause += ` AND (e.title ILIKE $${params.length} OR e.description ILIKE $${params.length} OR e.location ILIKE $${params.length})`;
    }

    const { enabled: isPaginated, page: requestedPage, limit: curLimit } = parsePagination(req.query);
    let curPage = requestedPage;
    let totalCount = 0;

    if (isPaginated) {
      const countRes = await db.get<{ total: string | number }>(`
        SELECT COUNT(*) as total FROM events e ${whereClause}
      `, params);
      totalCount = parseInt(String(countRes?.total || 0), 10);
      curPage = Math.min(curPage, Math.max(1, Math.ceil(totalCount / curLimit)));
    }

    let query = `
      SELECT e.id, e.title, e.description, e.start_time, e.end_time, e.location, 
             e.ministry_id, e.created_by, e.created_at,
             COALESCE((SELECT string_agg(m.name, ' + ' ORDER BY m.id) FROM event_ministries em JOIN ministries m ON m.id=em.ministry_id WHERE em.event_id=e.id AND em.enabled), min.name) as ministry_name, min.color as ministry_color, ${eventMinistryIdsSql()} AS ministry_ids,
             u.name as creator_name,
             (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND status = 'registered') as rsvp_count
      FROM events e
      LEFT JOIN ministries min ON e.ministry_id = min.id
      LEFT JOIN users u ON e.created_by = u.id
      ${whereClause}
      ORDER BY e.start_time ASC, e.id ASC
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
      SELECT r.*, ${recurringMinistryIdsSql()} AS ministry_ids, COALESCE((SELECT string_agg(m.name, ' + ' ORDER BY m.id) FROM recurring_event_ministries em JOIN ministries m ON m.id=em.ministry_id WHERE em.recurring_event_id=r.id AND em.enabled), min.name) as db_ministry_name, min.color as db_ministry_color
      FROM recurring_sunday_events r
      LEFT JOIN ministries min ON r.target_ministry_id = min.id
      WHERE r.is_active = TRUE
    `;
    const params: any[] = [];
    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND (r.target_ministry_id IS NULL OR r.target_ministry_id = $${params.length} OR EXISTS (SELECT 1 FROM recurring_event_ministries em WHERE em.recurring_event_id=r.id AND em.enabled AND em.ministry_id=$${params.length}))`;
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
router.post("/recurring-sunday-cycle", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
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

    const ministryIds = await requestedMinistries(req, res, true);
    if (!ministryIds) return;
    const result = await db.transaction(async client => {
      const saved = await client.query(`
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
      ministryIds[0] || null,
      target_ministry_name || null,
      color,
      icon,
      liturgical_notes || null,
      program_highlights || null
    ]);
      await saveEventMinistries(client, saved.rows[0].id, ministryIds, true);
      return { lastInsertRowid: saved.rows[0].id };
    });

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user?.id || null, "CREATE", "recurring_sunday_events", newId, `Created recurring Sunday event: ${title}`);
    emitRealtimeEvent("events:changed", { action: "create_recurring_sunday", id: newId });

    res.status(201).json({ id: newId, message: "Recurring Sunday celebration created successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update recurring Sunday event
router.put("/recurring-sunday-cycle/:id", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
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

    const ministryIds = await requestedMinistries(req, res, true , id);
    if (!ministryIds) return;
    await db.transaction(async client => {
      const saved = await client.query(`
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
      ministryIds[0] || null,
      target_ministry_name,
      color,
      icon,
      liturgical_notes,
      program_highlights,
      is_active !== undefined ? is_active : true,
      id
    ]);
      await saveEventMinistries(client, id, ministryIds, true);
      return { lastInsertRowid: id };
    });

    await logAuditAction(req.user?.id || null, "UPDATE", "recurring_sunday_events", id, `Updated recurring Sunday event #${id}`);
    emitRealtimeEvent("events:changed", { action: "update_recurring_sunday", id });

    res.json({ message: "Recurring Sunday event updated successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete recurring Sunday event
router.delete("/recurring-sunday-cycle/:id", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
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
router.post("/recurring-sunday-cycle/:id/sync-to-calendar", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
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

    const targets = await db.all('SELECT ministry_id FROM recurring_event_ministries WHERE recurring_event_id=$1 AND enabled ORDER BY ministry_id', [id]);
    const ministryIds = targets.map(row => row.ministry_id);
    const result = await db.transaction(async client => {
      const saved = await client.query(`
      INSERT INTO events (title, description, start_time, end_time, location, ministry_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      recurring.title,
      `${recurring.theme_tagline ? `${recurring.theme_tagline} — ` : ""}${recurring.description || ""}`,
      startTimeISO,
      endTimeISO,
      location,
      ministryIds[0] || null,
      req.user?.id || 1
    ]);
      await saveEventMinistries(client, saved.rows[0].id, ministryIds);
      return { lastInsertRowid: saved.rows[0].id };
    });

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
      SELECT e.*, COALESCE((SELECT string_agg(m.name, ' + ' ORDER BY m.id) FROM event_ministries em JOIN ministries m ON m.id=em.ministry_id WHERE em.event_id=e.id AND em.enabled), min.name) as ministry_name, min.color as ministry_color, ${eventMinistryIdsSql()} AS ministry_ids, u.name as creator_name
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
router.post("/", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
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

    const ministryIds = await requestedMinistries(req, res, false);
    if (!ministryIds) return;
    const result = await db.transaction(async client => {
      const saved = await client.query(`
      INSERT INTO events (ministry_id, title, description, start_time, end_time, location, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      ministryIds[0] || null,
      title.trim(),
      description || null,
      start_time,
      end_time,
      location || null,
      req.user!.id
    ]);
      await saveEventMinistries(client, saved.rows[0].id, ministryIds, false);
      return { lastInsertRowid: saved.rows[0].id };
    });

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user!.id, "CREATE", "events", newId, `Created event: ${title}`);

    emitRealtimeEvent("events:changed", { action: "create", id: newId });

    res.status(201).json({ id: newId, message: "Event created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// RSVP records planned participation; actual attendance uses check-in.
router.post("/:id/rsvp", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const eventId = Number(req.params.id);
    const { member_id, status = "registered" } = req.body;
    if (!Number.isSafeInteger(eventId) || eventId < 1 || !['registered','cancelled','pending'].includes(status) ||
        (member_id !== undefined && (!Number.isSafeInteger(member_id) || member_id < 1))) {
      return res.status(400).json({ error: 'Choose a valid event, member and planned RSVP status.' });
    }
    const event = await db.get(`SELECT e.*,${eventMinistryIdsSql('e')} AS ministry_ids FROM events e WHERE e.id=$1`,[eventId]);
    if (!event) return res.status(404).json({error:'Event not found.'});
    const linked = await db.get('SELECT id FROM members WHERE user_id=$1',[req.user!.id]);
    const targetMemberId = member_id ?? linked?.id;
    if (!targetMemberId) return res.status(400).json({error:'Select a member to RSVP. Your account is not linked to a member profile.'});
    const user = req.user!;
    const managesEvent = ['Admin','IT Admin','Pastor'].includes(user.role_name) ||
      (user.role_name === 'Coordinator' && (event.created_by === user.id || event.ministry_ids.some((id:number)=>user.ministry_ids.includes(id))));
    if (targetMemberId !== linked?.id && !managesEvent) return res.status(403).json({error:'You can only RSVP for your own linked member profile.'});
    const member = await db.get('SELECT id,status,ministry_id FROM members WHERE id=$1',[targetMemberId]);
    if (!member) return res.status(404).json({error:'Selected member no longer exists.'});
    if (member.status !== 'active' || (event.ministry_ids.length && !event.ministry_ids.includes(member.ministry_id))) {
      return res.status(400).json({error:'Choose an active member belonging to this event’s target ministry.'});
    }
    const saved = await db.get(`INSERT INTO event_registrations(event_id,member_id,status) VALUES($1,$2,$3)
      ON CONFLICT(event_id,member_id) DO UPDATE SET status=CASE
        WHEN event_registrations.status IN ('attended','checked_in','absent','excused') THEN event_registrations.status ELSE EXCLUDED.status END
      RETURNING status`,[eventId,targetMemberId,status]);
    emitRealtimeEvent('events:changed',{action:'rsvp',id:eventId});
    res.json({message:'RSVP saved',status:saved.status});
  } catch {
    res.status(500).json({error:'Unable to save RSVP. Please try again.'});
  }
});

// Get Event Attendance Roster & Check-In status
router.get("/:id/attendance-roster",authMiddleware,requireRoles('Admin','Pastor','Coordinator','Leader','Volunteer'),async(req:AuthRequest,res)=>{
  try{res.json(await eventParticipation(Number(req.params.id),req.user!,req.query.ministry_id));}
  catch(error){res.status(error instanceof ParticipationError?error.status:503).json({error:error instanceof ParticipationError?error.message:'Unable to load event attendance.'});}
});
router.post('/:id/participation/mark',authMiddleware,requireRoles('Admin','Pastor','Coordinator','Leader','Volunteer'),async(req:AuthRequest,res)=>{
  try{await markEventParticipant(Number(req.params.id),req.body,req.user!);emitRealtimeEvent('events:changed',{id:Number(req.params.id)});emitRealtimeEvent('attendance:new',{event_id:Number(req.params.id)});emitRealtimeEvent('attendance:changed',{event_id:Number(req.params.id)});res.json({success:true});}
  catch(error){res.status(error instanceof ParticipationError?error.status:503).json({error:error instanceof ParticipationError?error.message:'Attendance was not saved. Please retry.'});}
});

router.put('/:id/participation/sunday-reflection',authMiddleware,requireRoles('Admin','Pastor','Coordinator'),async(req:AuthRequest,res)=>{
  try{res.json(await setEventSundayReflection(Number(req.params.id),req.body.sunday_service_date,req.user!));emitRealtimeEvent('events:changed',{id:Number(req.params.id)});}
  catch(error){res.status(error instanceof ParticipationError?error.status:503).json({error:error instanceof ParticipationError?error.message:'Sunday reflection was not saved.'});}
});
router.post('/:id/participation/:action',authMiddleware,requireRoles('Admin','Pastor','Coordinator','Volunteer'),async(req:AuthRequest,res)=>{
  if(!['close','reopen'].includes(req.params.action))return res.status(404).json({error:'Unknown attendance action.'});
  try{const result=await closeEventAttendance(Number(req.params.id),req.user!,req.params.action==='reopen',req.body);emitRealtimeEvent('events:changed',{id:Number(req.params.id)});emitRealtimeEvent('attendance:changed',{event_id:Number(req.params.id)});res.json(result);}
  catch(error){res.status(error instanceof ParticipationError?error.status:503).json({error:error instanceof ParticipationError?error.message:'Attendance closing failed. No partial result was committed.'});}
});
router.get('/:id/participation/close-preview',authMiddleware,requireRoles('Admin','Pastor','Coordinator','Volunteer'),async(req:AuthRequest,res)=>{
  try{res.json(await previewEventClose(Number(req.params.id),req.user!,req.query.sunday==='1',req.query.ministry_ids===undefined?req.query.ministry_id:String(req.query.ministry_ids).split(',').map(Number)));}
  catch(error){res.status(error instanceof ParticipationError?error.status:503).json({error:error instanceof ParticipationError?error.message:'Unable to review remaining absences.'});}
});

// Legacy attendance clients use the same validated transactional write boundary.
router.post('/:id/attendance/mark',authMiddleware,requireRoles('Admin','Pastor','Coordinator','Leader','Volunteer'),async(req:AuthRequest,res)=>{
  const {member_ids,member_id,status='attended',reason,notes}=req.body;
  const ids=Array.isArray(member_ids)?member_ids:[member_id];
  const planned=['registered','unregistered'].includes(status)?'pending':status==='present'?'attended':status;
  try{await markEventParticipants(Number(req.params.id),ids.map(id=>({member_id:id,status:planned,reason:reason||notes||(status==='absent'?'Absent from event':status==='excused'?'Excused from event':'')})),req.user!);emitRealtimeEvent('events:changed',{id:Number(req.params.id)});emitRealtimeEvent('attendance:changed',{event_id:Number(req.params.id)});res.json({success:true,count:ids.length,status});}
  catch(error){res.status(error instanceof ParticipationError?error.status:503).json({error:error instanceof ParticipationError?error.message:'Attendance was not saved.'});}
});
router.post('/:id/attendance/batch-mark',authMiddleware,requireRoles('Admin','Pastor','Coordinator','Leader','Volunteer'),async(req:AuthRequest,res)=>{
  const {present_ids=[],absent_ids=[],notes='',expected_sunday_service_date}=req.body;
  if(!Array.isArray(present_ids)||!Array.isArray(absent_ids)||new Set([...present_ids,...absent_ids]).size!==present_ids.length+absent_ids.length)return res.status(400).json({error:'Select distinct participants.'});
  try{await markEventParticipants(Number(req.params.id),[...present_ids.map(id=>({member_id:id,status:'attended',expected_sunday_service_date})),...absent_ids.map(id=>({member_id:id,status:'absent',reason:notes||'Absent from event'}))],req.user!);emitRealtimeEvent('events:changed',{id:Number(req.params.id)});emitRealtimeEvent('attendance:changed',{event_id:Number(req.params.id)});res.json({success:true,marked_present:present_ids.length,marked_absent:absent_ids.length});}
  catch(error){res.status(error instanceof ParticipationError?error.status:503).json({error:error instanceof ParticipationError?error.message:'Attendance was not saved.'});}
});

router.put("/:id", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { ministry_id, title, description, start_time, end_time, location } = req.body;

    if (start_time && end_time && new Date(end_time).getTime() < new Date(start_time).getTime()) {
      return res.status(400).json({ error: "End time cannot be earlier than start time" });
    }

    const ministryIds = await requestedMinistries(req, res, false , id);
    if (!ministryIds) return;
    await db.transaction(async client => {
      const saved = await client.query(`
      UPDATE events
      SET ministry_id = $1,
          title = COALESCE($2, title),
          description = COALESCE($3, description),
          start_time = COALESCE($4, start_time),
          end_time = COALESCE($5, end_time),
          location = COALESCE($6, location)
      WHERE id = $7
    `, [
      ministryIds[0] || null,
      title ? title.trim() : null,
      description,
      start_time,
      end_time,
      location,
      id
    ]);
      await saveEventMinistries(client, id, ministryIds, false);
      return { lastInsertRowid: id };
    });

    await logAuditAction(req.user!.id, "UPDATE", "events", id, `Updated event #${id}`);
    emitRealtimeEvent("events:changed", { action: "update", id });

    res.json({ message: "Event updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete event
router.delete("/:id", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
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

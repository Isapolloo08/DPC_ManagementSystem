import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";

const router = Router();

// Helper to generate security code for children (e.g. KND-7821, ELM-4890)
function generateSecurityCode(ministryName: string): string {
  const prefix = ministryName.substring(0, 3).toUpperCase();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
}

// Get active check-ins for today or selected date
router.get("/today", async (req: Request, res: Response) => {
  try {
    const { ministry_id, date } = req.query;

    const targetDate = date && typeof date === "string" ? date : null;

    let query = `
      SELECT a.*, 
             m.first_name, m.last_name, m.birthdate, m.photo_url, m.medical_notes, m.grade_level,
             min.name as ministry_name, min.color as ministry_color,
             h.name as household_name, h.primary_contact_phone as parent_phone,
             u.name as checked_in_by_name
      FROM attendance a
      JOIN members m ON a.member_id = m.id
      JOIN ministries min ON a.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      LEFT JOIN users u ON a.checked_in_by = u.id
      WHERE DATE(a.checked_in_at) = ${targetDate ? "$1" : "CURRENT_DATE"}
    `;
    const params: any[] = [];

    if (targetDate) {
      params.push(targetDate);
    }

    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND a.ministry_id = $${params.length}`;
    }

    query += " ORDER BY a.checked_in_at DESC";

    const rows = await db.all(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sunday Service Roster (all members with today's attendance status for quick roll-call)
router.get("/roster", async (req: Request, res: Response) => {
  try {
    const { ministry_id, search, household_id, date } = req.query;
    const targetDate = date && typeof date === "string" ? date : null;

    let query = `
      SELECT m.id as member_id, m.first_name, m.last_name, m.birthdate, m.gender,
             m.status as member_status, m.grade_level, m.medical_notes, m.photo_url,
             m.ministry_id, min.name as ministry_name, min.color as ministry_color,
             m.household_id, h.name as household_name, h.primary_contact_phone as parent_phone,
             a.id as attendance_id, a.checked_in_at, a.checked_out_at, a.security_code,
             a.notes as attendance_notes, u.name as checked_in_by_name,
             CASE 
               WHEN a.id IS NOT NULL AND (a.notes ILIKE '%[ABSENT]%' OR a.notes ILIKE '%[EXCUSED]%') THEN 0
               WHEN a.id IS NOT NULL THEN 1 
               ELSE 0 
             END as is_present,
             CASE
               WHEN a.notes ILIKE '%[ABSENT]%' THEN 'absent'
               WHEN a.notes ILIKE '%[EXCUSED]%' THEN 'excused'
               WHEN a.checked_out_at IS NOT NULL THEN 'checked_out'
               WHEN a.id IS NOT NULL THEN 'present'
               ELSE 'unmarked'
             END as attendance_status
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      LEFT JOIN households h ON m.household_id = h.id
      LEFT JOIN attendance a ON a.member_id = m.id AND DATE(a.checked_in_at) = ${targetDate ? "$1" : "CURRENT_DATE"}
      LEFT JOIN users u ON a.checked_in_by = u.id
      WHERE m.status = 'active'
    `;
    const params: any[] = [];

    if (targetDate) {
      params.push(targetDate);
    }

    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND m.ministry_id = $${params.length}`;
    }

    if (household_id) {
      params.push(household_id);
      query += ` AND m.household_id = $${params.length}`;
    }

    if (search && typeof search === "string") {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      query += ` AND (m.first_name ILIKE $${pIdx} OR m.last_name ILIKE $${pIdx} OR h.name ILIKE $${pIdx})`;
    }

    query += " ORDER BY LOWER(m.first_name) ASC, LOWER(m.last_name) ASC";

    const rows = await db.all(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check-in member / Mark attendance (Present, Absent, Excused)
router.post("/check-in", authMiddleware, requireRoles("Admin", "Coordinator", "Volunteer"), async (req: AuthRequest, res: Response) => {
  try {
    const { member_id, ministry_id, event_id, notes, service_name, status = "present", reason, target_date } = req.body;

    if (!member_id) {
      return res.status(400).json({ error: "member_id is required" });
    }

    const member = await db.get("SELECT * FROM members WHERE id = $1", [member_id]);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    const assignedMinistryId = ministry_id || member.ministry_id || 1;
    const ministry = await db.get("SELECT * FROM ministries WHERE id = $1", [assignedMinistryId]);
    if (!ministry) {
      return res.status(404).json({ error: "Ministry not found" });
    }

    const dateClause = target_date ? "DATE(checked_in_at) = $2" : "DATE(checked_in_at) = CURRENT_DATE";
    const dateParams = target_date ? [member_id, target_date] : [member_id];

    // Check if member already has an attendance record for this date
    const existing = await db.get(`
      SELECT * FROM attendance
      WHERE member_id = $1 AND ${dateClause}
    `, dateParams);

    let securityCode: string | null = null;
    let combinedNotes = "";

    if (status === "absent") {
      combinedNotes = `[ABSENT] ${reason || notes || "Absent from Sunday Service"}`;
    } else if (status === "excused") {
      combinedNotes = `[EXCUSED] ${reason || notes || "Excused Absence"}`;
    } else {
      // Present - Generate security tag for Kinder and Elementary minors
      if (ministry.name === "Kinder" || ministry.name === "Elementary" || (ministry.max_age && ministry.max_age <= 12)) {
        securityCode = generateSecurityCode(ministry.name);
      }
      combinedNotes = [service_name || "Sunday Divine Worship", notes].filter(Boolean).join(" • ");
    }

    if (existing) {
      // Update existing record with new status
      await db.run(`
        UPDATE attendance
        SET ministry_id = $1,
            security_code = $2,
            notes = $3,
            checked_out_at = NULL,
            checked_in_by = $4
        WHERE id = $5
      `, [
        assignedMinistryId,
        securityCode,
        combinedNotes || null,
        req.user?.id || null,
        existing.id
      ]);

      await logAuditAction(req.user?.id || null, "UPDATE_ATTENDANCE", "attendance", existing.id, `Updated attendance status to ${status.toUpperCase()} for ${member.first_name} ${member.last_name}`);
      emitRealtimeEvent("attendance:changed", { action: "update_status", memberId: member_id, ministryId: assignedMinistryId, status });

      return res.json({
        id: existing.id,
        message: `${member.first_name} ${member.last_name} marked as ${status.toUpperCase()}!`,
        security_code: securityCode,
        member_name: `${member.first_name} ${member.last_name}`,
        ministry_name: ministry.name,
        medical_notes: member.medical_notes,
        attendance_status: status,
        checked_in_at: existing.checked_in_at
      });
    }

    const checkinTimestamp = target_date ? `${target_date} 09:30:00` : new Date().toISOString();

    const result = await db.run(`
      INSERT INTO attendance (
        member_id, ministry_id, event_id, security_code, checked_in_by, notes, checked_in_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      member_id,
      assignedMinistryId,
      event_id || null,
      securityCode,
      req.user?.id || null,
      combinedNotes || null,
      checkinTimestamp
    ]);

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user?.id || null, "CHECK_IN", "attendance", newId, `Sunday Worship Attendance (${status.toUpperCase()}): ${member.first_name} ${member.last_name} (${ministry.name})`);

    emitRealtimeEvent("attendance:changed", { action: "check_in", memberId: member_id, ministryId: assignedMinistryId, status });

    res.status(201).json({
      id: newId,
      message: `${member.first_name} ${member.last_name} marked as ${status.toUpperCase()}!`,
      security_code: securityCode,
      member_name: `${member.first_name} ${member.last_name}`,
      ministry_name: ministry.name,
      medical_notes: member.medical_notes,
      attendance_status: status,
      checked_in_at: checkinTimestamp
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch Mark Attendance (Fast bulk roll call: present, absent, excused, reset)
router.post("/batch-mark", authMiddleware, requireRoles("Admin", "Coordinator", "Volunteer"), async (req: AuthRequest, res: Response) => {
  try {
    const {
      present_ids = [],
      absent_ids = [],
      excused_ids = [],
      unmark_ids = [],
      target_date,
      service_name = "Sunday Divine Worship"
    } = req.body;

    const dateClause = target_date ? "DATE(checked_in_at) = $2" : "DATE(checked_in_at) = CURRENT_DATE";
    const checkinTimestamp = target_date ? `${target_date} 09:30:00` : new Date().toISOString();

    let markedPresentCount = 0;
    let markedAbsentCount = 0;
    let markedExcusedCount = 0;
    let unmarkedCount = 0;

    const allMemberIds = Array.from(new Set([
      ...present_ids,
      ...absent_ids,
      ...excused_ids,
      ...unmark_ids
    ].map(Number))).filter(id => Boolean(id) && !isNaN(id));

    if (allMemberIds.length === 0) {
      return res.json({ success: true, message: "No members to update", stats: {} });
    }

    // Single query to fetch all relevant members and ministries
    const memberRows = await db.all(`
      SELECT m.id, m.ministry_id, min.name as ministry_name, min.max_age
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      WHERE m.id = ANY($1)
    `, [allMemberIds]);

    const memberMap = new Map<number, any>();
    for (const m of memberRows) {
      memberMap.set(m.id, m);
    }

    // Single query to fetch existing attendance records
    const existingParams = target_date ? [allMemberIds, target_date] : [allMemberIds];
    const existingRows = await db.all(`
      SELECT id, member_id, security_code
      FROM attendance
      WHERE member_id = ANY($1) AND ${dateClause}
    `, existingParams);

    const existingMap = new Map<number, any>();
    for (const r of existingRows) {
      existingMap.set(r.member_id, r);
    }

    // Execute all updates and inserts atomically in a transaction
    await db.transaction(async (client) => {
      // 1. Process Present IDs
      if (Array.isArray(present_ids) && present_ids.length > 0) {
        for (const mId of present_ids) {
          const member = memberMap.get(Number(mId));
          if (!member) continue;

          const ministryId = member.ministry_id || 1;
          let securityCode: string | null = null;
          if (member.ministry_name === "Kinder" || member.ministry_name === "Elementary" || (member.max_age && member.max_age <= 12)) {
            securityCode = generateSecurityCode(member.ministry_name || "MIN");
          }

          const existing = existingMap.get(Number(mId));
          if (existing) {
            await client.query(`
              UPDATE attendance
              SET ministry_id = $1,
                  security_code = COALESCE(security_code, $2),
                  notes = $3,
                  checked_out_at = NULL,
                  checked_in_by = $4
              WHERE id = $5
            `, [ministryId, securityCode, service_name, req.user?.id || null, existing.id]);
          } else {
            await client.query(`
              INSERT INTO attendance (
                member_id, ministry_id, security_code, checked_in_by, notes, checked_in_at
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [mId, ministryId, securityCode, req.user?.id || null, service_name, checkinTimestamp]);
          }
          markedPresentCount++;
        }
      }

      // 2. Process Absent IDs
      if (Array.isArray(absent_ids) && absent_ids.length > 0) {
        for (const mId of absent_ids) {
          const member = memberMap.get(Number(mId));
          if (!member) continue;

          const ministryId = member.ministry_id || 1;
          const absentNotes = `[ABSENT] Absent from ${service_name}`;
          const existing = existingMap.get(Number(mId));

          if (existing) {
            await client.query(`
              UPDATE attendance
              SET ministry_id = $1,
                  security_code = NULL,
                  notes = $2,
                  checked_out_at = NULL,
                  checked_in_by = $3
              WHERE id = $4
            `, [ministryId, absentNotes, req.user?.id || null, existing.id]);
          } else {
            await client.query(`
              INSERT INTO attendance (
                member_id, ministry_id, security_code, checked_in_by, notes, checked_in_at
              ) VALUES ($1, $2, NULL, $3, $4, $5)
            `, [mId, ministryId, req.user?.id || null, absentNotes, checkinTimestamp]);
          }
          markedAbsentCount++;
        }
      }

      // 3. Process Excused IDs
      if (Array.isArray(excused_ids) && excused_ids.length > 0) {
        for (const mId of excused_ids) {
          const member = memberMap.get(Number(mId));
          if (!member) continue;

          const ministryId = member.ministry_id || 1;
          const excusedNotes = `[EXCUSED] Excused Absence (${service_name})`;
          const existing = existingMap.get(Number(mId));

          if (existing) {
            await client.query(`
              UPDATE attendance
              SET ministry_id = $1,
                  security_code = NULL,
                  notes = $2,
                  checked_out_at = NULL,
                  checked_in_by = $3
              WHERE id = $4
            `, [ministryId, excusedNotes, req.user?.id || null, existing.id]);
          } else {
            await client.query(`
              INSERT INTO attendance (
                member_id, ministry_id, security_code, checked_in_by, notes, checked_in_at
              ) VALUES ($1, $2, NULL, $3, $4, $5)
            `, [mId, ministryId, req.user?.id || null, excusedNotes, checkinTimestamp]);
          }
          markedExcusedCount++;
        }
      }

      // 4. Process Unmark IDs (Delete attendance record)
      if (Array.isArray(unmark_ids) && unmark_ids.length > 0) {
        const deleteParams = target_date ? [unmark_ids, target_date] : [unmark_ids];
        const delRes = await client.query(`
          DELETE FROM attendance
          WHERE member_id = ANY($1) AND ${dateClause}
        `, deleteParams);
        unmarkedCount += delRes.rowCount || 0;
      }
    });

    const totalUpdated = markedPresentCount + markedAbsentCount + markedExcusedCount + unmarkedCount;
    await logAuditAction(
      req.user?.id || null,
      "BATCH_ATTENDANCE",
      "attendance",
      null,
      `Batch attendance updated: ${markedPresentCount} Present, ${markedAbsentCount} Absent, ${markedExcusedCount} Excused, ${unmarkedCount} Unmarked on ${target_date || "today"}`
    );

    emitRealtimeEvent("attendance:changed", {
      action: "batch_mark",
      totalUpdated,
      markedPresentCount,
      markedAbsentCount,
      markedExcusedCount,
      unmarkedCount,
      targetDate: target_date
    });

    res.json({
      success: true,
      message: `Batch attendance successfully updated! (${markedPresentCount} Present, ${markedAbsentCount} Absent)`,
      stats: {
        present: markedPresentCount,
        absent: markedAbsentCount,
        excused: markedExcusedCount,
        unmarked: unmarkedCount,
        total: totalUpdated
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Batch Check-in (e.g. Household group check-in or multi-select present)
router.post("/batch-check-in", authMiddleware, requireRoles("Admin", "Coordinator", "Volunteer"), async (req: AuthRequest, res: Response) => {
  try {
    const { member_ids, service_name } = req.body;

    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({ error: "member_ids array is required" });
    }

    const checkedInMembers = [];

    for (const mId of member_ids) {
      const member = await db.get("SELECT * FROM members WHERE id = $1", [mId]);
      if (!member) continue;

      const ministryId = member.ministry_id || 1;
      const ministry = await db.get("SELECT * FROM ministries WHERE id = $1", [ministryId]);

      // Check if already checked in today
      const existing = await db.get("SELECT id FROM attendance WHERE member_id = $1 AND DATE(checked_in_at) = CURRENT_DATE", [mId]);
      if (existing) continue;

      let securityCode: string | null = null;
      if (ministry && (ministry.name === "Kinder" || ministry.name === "Elementary" || (ministry.max_age && ministry.max_age <= 12))) {
        securityCode = generateSecurityCode(ministry.name);
      }

      const result = await db.run(`
        INSERT INTO attendance (member_id, ministry_id, security_code, checked_in_by, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [mId, ministryId, securityCode, req.user?.id || null, service_name || "Sunday Worship Household Check-in"]);

      checkedInMembers.push({
        id: result.lastInsertRowid,
        member_id: mId,
        member_name: `${member.first_name} ${member.last_name}`,
        security_code: securityCode
      });
    }

    await logAuditAction(req.user?.id || null, "CHECK_IN", "attendance", null, `Batch check-in performed for ${checkedInMembers.length} members`);

    emitRealtimeEvent("attendance:changed", { action: "batch_check_in", count: checkedInMembers.length });

    res.status(201).json({
      message: `Successfully checked in ${checkedInMembers.length} member(s)`,
      checked_in: checkedInMembers
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check-out member (Kinder & Elementary security tag matching or direct verification)
router.post("/check-out", authMiddleware, requireRoles("Admin", "Coordinator", "Volunteer"), async (req: AuthRequest, res: Response) => {
  try {
    const { attendance_id, member_id, security_code, force = false } = req.body;

    let record: any = null;
    if (attendance_id) {
      record = await db.get(`
        SELECT a.*, min.name as ministry_name 
        FROM attendance a 
        JOIN ministries min ON a.ministry_id = min.id 
        WHERE a.id = $1
      `, [attendance_id]);
    } else if (member_id) {
      record = await db.get(`
        SELECT a.*, min.name as ministry_name
        FROM attendance a
        JOIN ministries min ON a.ministry_id = min.id
        WHERE a.member_id = $1 AND DATE(a.checked_in_at) = CURRENT_DATE AND a.checked_out_at IS NULL
      `, [member_id]);
    }

    if (!record) {
      return res.status(404).json({ error: "Active check-in record not found" });
    }

    // Security code matching for Kinder & Elementary minors unless forced/verified directly
    if (!force && record.security_code && security_code) {
      if (record.security_code.trim().toUpperCase() !== security_code.trim().toUpperCase()) {
        return res.status(400).json({ error: `Security code mismatch! Provided: ${security_code}, Expected matching parent security tag code.` });
      }
    }

    const now = new Date().toISOString();
    await db.run(`
      UPDATE attendance
      SET checked_out_at = $1
      WHERE id = $2
    `, [now, record.id]);

    await logAuditAction(req.user?.id || null, "CHECK_OUT", "attendance", record.id, `Checked out attendance #${record.id}`);

    emitRealtimeEvent("attendance:changed", { action: "check_out", attendanceId: record.id });

    res.json({
      message: "Member checked out successfully",
      checked_out_at: now
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete / Undo check-in (Admin & Coordinator)
router.delete("/:id", authMiddleware, requireRoles("Admin", "Coordinator", "Volunteer"), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const current = await db.get("SELECT a.*, m.first_name, m.last_name FROM attendance a JOIN members m ON a.member_id = m.id WHERE a.id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Attendance record not found" });

    await db.run("DELETE FROM attendance WHERE id = $1", [id]);
    await logAuditAction(req.user?.id || null, "DELETE", "attendance", Number(id), `Undid attendance mark for ${current.first_name} ${current.last_name}`);

    emitRealtimeEvent("attendance:changed", { action: "delete", attendanceId: Number(id) });

    res.json({ message: `Attendance mark for ${current.first_name} ${current.last_name} removed.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance summary trends by ministry
router.get("/trends", async (req: Request, res: Response) => {
  try {
    const { ministry_id } = req.query;
    let query = "SELECT * FROM ministries";
    const params: any[] = [];
    if (ministry_id) {
      params.push(Number(ministry_id));
      query += " WHERE id = $1";
    } else {
      query += " ORDER BY id ASC";
    }
    const [ministries, totalCheckinsRows, weeklyRows] = await Promise.all([
      db.all(query, params),
      db.all(`
        SELECT ministry_id, COUNT(*) as count
        FROM attendance
        ${ministry_id ? "WHERE ministry_id = $1" : ""}
        GROUP BY ministry_id
      `, params),
      db.all(`
        SELECT ministry_id, to_char(checked_in_at, 'YYYY-IW') as week, COUNT(*) as count
        FROM attendance
        ${ministry_id ? "WHERE ministry_id = $1" : ""}
        GROUP BY ministry_id, week
        ORDER BY week DESC
      `, params)
    ]);

    const totalCheckinsByMin = new Map<number, number>();
    for (const r of totalCheckinsRows) {
      totalCheckinsByMin.set(r.ministry_id, Number(r.count || 0));
    }

    const weeklyByMin = new Map<number, any[]>();
    for (const w of weeklyRows) {
      if (!weeklyByMin.has(w.ministry_id)) weeklyByMin.set(w.ministry_id, []);
      if (weeklyByMin.get(w.ministry_id)!.length < 6) {
        weeklyByMin.get(w.ministry_id)!.push({
          week: w.week,
          count: Number(w.count || 0)
        });
      }
    }

    const trends = ministries.map((m) => {
      const weekly = (weeklyByMin.get(m.id) || []).slice().reverse();
      return {
        ministry_id: m.id,
        ministry_name: m.name,
        color: m.color,
        total_checkins: totalCheckinsByMin.get(m.id) || 0,
        weekly
      };
    });

    res.json(trends);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;


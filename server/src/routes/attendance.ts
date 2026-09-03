import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";

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
             CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as is_present
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

    query += " ORDER BY min.id ASC, h.name ASC, m.first_name ASC";

    const rows = await db.all(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check-in member (Kiosk / Volunteer / Coordinator / Sunday Usher)
router.post("/check-in", authMiddleware, requireRoles("Admin", "Coordinator", "Volunteer"), async (req: AuthRequest, res: Response) => {
  try {
    const { member_id, ministry_id, event_id, notes, service_name } = req.body;

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

    // Check if member already has an open check-in today
    const existing = await db.get(`
      SELECT * FROM attendance
      WHERE member_id = $1 AND DATE(checked_in_at) = CURRENT_DATE AND checked_out_at IS NULL
    `, [member_id]);

    if (existing) {
      return res.json({
        message: "Member is already marked present for today's service.",
        attendance: existing,
        already_present: true
      });
    }

    // Generate security tag for Kinder and Elementary minors
    let securityCode: string | null = null;
    if (ministry.name === "Kinder" || ministry.name === "Elementary" || (ministry.max_age && ministry.max_age <= 12)) {
      securityCode = generateSecurityCode(ministry.name);
    }

    const combinedNotes = [service_name || "Sunday Divine Worship", notes].filter(Boolean).join(" • ");

    const result = await db.run(`
      INSERT INTO attendance (
        member_id, ministry_id, event_id, security_code, checked_in_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      member_id,
      assignedMinistryId,
      event_id || null,
      securityCode,
      req.user?.id || null,
      combinedNotes || null
    ]);

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user?.id || null, "CHECK_IN", "attendance", newId, `Sunday Worship Attendance: ${member.first_name} ${member.last_name} (${ministry.name})`);

    res.status(201).json({
      id: newId,
      message: `${member.first_name} ${member.last_name} marked present for Sunday Worship!`,
      security_code: securityCode,
      member_name: `${member.first_name} ${member.last_name}`,
      ministry_name: ministry.name,
      medical_notes: member.medical_notes,
      checked_in_at: new Date().toISOString()
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

    res.status(201).json({
      message: `Successfully checked in ${checkedInMembers.length} member(s)`,
      checked_in: checkedInMembers
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check-out member (Kinder & Elementary security tag matching)
router.post("/check-out", authMiddleware, requireRoles("Admin", "Coordinator", "Volunteer"), async (req: AuthRequest, res: Response) => {
  try {
    const { attendance_id, member_id, security_code } = req.body;

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

    // Security code matching for Kinder & Elementary
    if (record.security_code && security_code) {
      if (record.security_code.trim().toUpperCase() !== security_code.trim().toUpperCase()) {
        return res.status(400).json({ error: `Security code mismatch! Provided: ${security_code}, Expected code from parent tag.` });
      }
    }

    const now = new Date().toISOString();
    await db.run(`
      UPDATE attendance
      SET checked_out_at = $1
      WHERE id = $2
    `, [now, record.id]);

    await logAuditAction(req.user?.id || null, "CHECK_OUT", "attendance", record.id, `Checked out attendance #${record.id}`);

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
    const ministries = await db.all(query, params);

    const trends = await Promise.all(ministries.map(async (m) => {
      const totalCheckins = await db.get<{ count: string | number }>(`
        SELECT COUNT(*) as count FROM attendance WHERE ministry_id = $1
      `, [m.id]);

      const weeklyBreakdown = await db.all(`
        SELECT to_char(checked_in_at, 'YYYY-IW') as week, COUNT(*) as count
        FROM attendance
        WHERE ministry_id = $1
        GROUP BY week
        ORDER BY week DESC
        LIMIT 6
      `, [m.id]);

      return {
        ministry_id: m.id,
        ministry_name: m.name,
        color: m.color,
        total_checkins: Number(totalCheckins?.count || 0),
        weekly: weeklyBreakdown.reverse().map(w => ({
          week: w.week,
          count: Number(w.count)
        }))
      };
    }));

    res.json(trends);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

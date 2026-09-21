import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";
import { resolveTotalChapters } from "./studyTopics";

const router = Router();

// List Bible study groups with members
router.get("/", async (req: Request, res: Response) => {
  try {
    const { ministry_id, category, meeting_day, search } = req.query;

    let query = `
      SELECT g.*, min.name as ministry_name, min.color as ministry_color,
             (SELECT COUNT(*) FROM bible_study_members WHERE group_id = g.id) as current_member_count
      FROM bible_study_groups g
      LEFT JOIN ministries min ON g.ministry_id = min.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND g.ministry_id = $${params.length}`;
    }

    if (category) {
      params.push(category);
      query += ` AND g.category = $${params.length}`;
    }

    if (meeting_day) {
      params.push(meeting_day);
      query += ` AND g.meeting_day = $${params.length}`;
    }

    if (search && typeof search === "string") {
      params.push(`%${search}%`);
      const pIdx = params.length;
      query += ` AND (g.name ILIKE $${pIdx} OR g.leader_name ILIKE $${pIdx} OR g.curriculum ILIKE $${pIdx} OR g.location ILIKE $${pIdx})`;
    }

    query += " ORDER BY g.id ASC";

    const [groups, dbTopics, allGroupMembers] = await Promise.all([
      db.all(query, params),
      db.all<{ title: string; total_chapters: number }>("SELECT title, total_chapters FROM bible_study_topics").catch(() => []),
      db.all(`
        SELECT bsm.*, m.first_name, m.last_name, m.contact_email, m.contact_phone
        FROM bible_study_members bsm
        LEFT JOIN members m ON bsm.member_id = m.id
        ORDER BY COALESCE(LOWER(m.first_name), LOWER(bsm.member_name)) ASC, LOWER(m.last_name) ASC
      `)
    ]);

    // Group members by group_id in memory
    const membersByGroup = new Map<number, any[]>();
    for (const bsm of allGroupMembers) {
      const gId = bsm.group_id;
      if (!membersByGroup.has(gId)) membersByGroup.set(gId, []);
      membersByGroup.get(gId)!.push({
        ...bsm,
        display_name: bsm.first_name ? `${bsm.first_name} ${bsm.last_name}` : bsm.member_name
      });
    }

    const detailed = groups.map((g) => {
      const members = membersByGroup.get(g.id) || [];
      const totalChapters = resolveTotalChapters(g.curriculum || "", dbTopics);

      return {
        ...g,
        curriculum_total_chapters: totalChapters,
        current_member_count: members.length || Number(g.current_member_count || 0),
        members
      };
    });

    res.json(detailed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific group
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const group = await db.get(`
      SELECT g.*, min.name as ministry_name, min.color as ministry_color
      FROM bible_study_groups g
      LEFT JOIN ministries min ON g.ministry_id = min.id
      WHERE g.id = $1
    `, [req.params.id]);

    if (!group) {
      return res.status(404).json({ error: "Small group not found" });
    }

    const [members, dbTopics] = await Promise.all([
      db.all(`
        SELECT bsm.*, m.first_name, m.last_name, m.contact_email, m.contact_phone
        FROM bible_study_members bsm
        LEFT JOIN members m ON bsm.member_id = m.id
        WHERE bsm.group_id = $1
        ORDER BY COALESCE(LOWER(m.first_name), LOWER(bsm.member_name)) ASC, LOWER(m.last_name) ASC
      `, [group.id]),
      db.all<{ title: string; total_chapters: number }>("SELECT title, total_chapters FROM bible_study_topics").catch(() => [])
    ]);

    const totalChapters = resolveTotalChapters(group.curriculum || "", dbTopics);

    res.json({
      ...group,
      curriculum_total_chapters: totalChapters,
      members: members.map(m => ({
        ...m,
        display_name: m.first_name ? `${m.first_name} ${m.last_name}` : m.member_name
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create group (Admin / Coordinator)
router.post("/", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      description,
      curriculum,
      ministry_id,
      leader_name,
      leader_contact,
      meeting_day,
      meeting_time,
      location,
      category = "General",
      max_capacity = 12,
      member_ids = [],
      current_chapter = "Chapter 1",
      progress_stage = "in_progress",
      progress_notes = null
    } = req.body;

    if (!name || !name.trim() || !leader_name || !leader_name.trim() || !meeting_day || !meeting_time || !location) {
      return res.status(400).json({ error: "Group name, leader name, day, time, and location are required" });
    }

    const existing = await db.get("SELECT id FROM bible_study_groups WHERE LOWER(name) = LOWER($1)", [name.trim()]);
    if (existing) {
      return res.status(400).json({ error: "A Bible study group with this name already exists" });
    }

    const result = await db.run(`
      INSERT INTO bible_study_groups (
        name, description, curriculum, ministry_id, leader_name, leader_contact,
        meeting_day, meeting_time, location, category, max_capacity,
        current_chapter, progress_stage, progress_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      name.trim(),
      description || null,
      curriculum || null,
      ministry_id ? Number(ministry_id) : null,
      leader_name.trim(),
      leader_contact || null,
      meeting_day,
      meeting_time,
      location,
      category,
      Number(max_capacity) || 12,
      current_chapter || 'Chapter 1',
      progress_stage || 'in_progress',
      progress_notes || null
    ]);

    const newId = result.lastInsertRowid;

    // Enroll initial selected members if provided
    if (Array.isArray(member_ids) && member_ids.length > 0) {
      for (const mId of member_ids) {
        const member = await db.get("SELECT first_name, last_name FROM members WHERE id = $1", [mId]);
        const mName = member ? `${member.first_name} ${member.last_name}` : "Member";
        await db.run(`
          INSERT INTO bible_study_members (group_id, member_id, member_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (group_id, member_id) DO NOTHING
        `, [newId, mId, mName]);
      }
    }

    await logAuditAction(req.user?.id || null, "CREATE", "bible_study_groups", newId, `Created Bible study group: ${name}`);
    emitRealtimeEvent("groups:changed", { action: "create", id: newId });

    res.status(201).json({ id: newId, message: "Small group created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update group
router.put("/:id", authMiddleware, requireRoles("Admin", "Coordinator", "Leader"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const {
      name,
      description,
      curriculum,
      ministry_id,
      leader_name,
      leader_contact,
      meeting_day,
      meeting_time,
      location,
      category,
      max_capacity,
      member_ids,
      current_chapter,
      progress_stage,
      progress_notes,
      is_rescheduled,
      rescheduled_date,
      rescheduled_time,
      reschedule_reason
    } = req.body;

    const current = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Small group not found" });

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "Group name cannot be empty" });
      const duplicate = await db.get("SELECT id FROM bible_study_groups WHERE LOWER(name) = LOWER($1) AND id != $2", [name.trim(), id]);
      if (duplicate) return res.status(400).json({ error: "Another Bible study group already has this name" });
    }

    await db.run(`
      UPDATE bible_study_groups
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          curriculum = COALESCE($3, curriculum),
          ministry_id = COALESCE($4, ministry_id),
          leader_name = COALESCE($5, leader_name),
          leader_contact = COALESCE($6, leader_contact),
          meeting_day = COALESCE($7, meeting_day),
          meeting_time = COALESCE($8, meeting_time),
          location = COALESCE($9, location),
          category = COALESCE($10, category),
          max_capacity = COALESCE($11, max_capacity),
          current_chapter = COALESCE($12, current_chapter),
          progress_stage = COALESCE($13, progress_stage),
          progress_notes = COALESCE($14, progress_notes),
          is_rescheduled = COALESCE($15, is_rescheduled),
          rescheduled_date = COALESCE($16, rescheduled_date),
          rescheduled_time = COALESCE($17, rescheduled_time),
          reschedule_reason = COALESCE($18, reschedule_reason)
      WHERE id = $19
    `, [
      name !== undefined ? name.trim() : null,
      description,
      curriculum,
      ministry_id !== undefined ? (ministry_id ? Number(ministry_id) : null) : null,
      leader_name !== undefined ? leader_name.trim() : null,
      leader_contact,
      meeting_day,
      meeting_time,
      location,
      category,
      max_capacity !== undefined ? Number(max_capacity) : null,
      current_chapter,
      progress_stage,
      progress_notes,
      is_rescheduled !== undefined ? Boolean(is_rescheduled) : null,
      rescheduled_date,
      rescheduled_time,
      reschedule_reason,
      id
    ]);

    // Update members if member_ids is passed
    if (Array.isArray(member_ids)) {
      await db.run("DELETE FROM bible_study_members WHERE group_id = $1", [id]);
      for (const mId of member_ids) {
        const member = await db.get("SELECT first_name, last_name FROM members WHERE id = $1", [mId]);
        const mName = member ? `${member.first_name} ${member.last_name}` : "Member";
        await db.run(`
          INSERT INTO bible_study_members (group_id, member_id, member_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (group_id, member_id) DO NOTHING
        `, [id, mId, mName]);
      }
    }

    await logAuditAction(req.user?.id || null, "UPDATE", "bible_study_groups", Number(id), `Updated small group: ${name || current.name}`);
    emitRealtimeEvent("groups:changed", { action: "update", id: Number(id) });
    res.json({ message: "Small group updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dedicated Fast Endpoint: Update Study Chapter Progress & Notice
router.patch("/:id/progress", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { current_chapter, progress_stage, progress_notes } = req.body;

    const current = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Small group not found" });

    await db.run(`
      UPDATE bible_study_groups
      SET current_chapter = COALESCE($1, current_chapter),
          progress_stage = COALESCE($2, progress_stage),
          progress_notes = $3
      WHERE id = $4
    `, [
      current_chapter ? current_chapter.trim() : current.current_chapter,
      progress_stage || current.progress_stage || 'in_progress',
      progress_notes !== undefined ? progress_notes : current.progress_notes,
      id
    ]);

    await logAuditAction(
      req.user?.id || null,
      "UPDATE_PROGRESS",
      "bible_study_groups",
      Number(id),
      `Updated chapter progress for ${current.name}: ${current_chapter || current.current_chapter}`
    );

    emitRealtimeEvent("groups:changed", { action: "update_progress", id: Number(id) });
    res.json({ message: "Study chapter progress updated successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dedicated Fast Endpoint: Reschedule Small Group Next Meeting Session
router.patch("/:id/reschedule", authMiddleware, requireRoles("Admin", "Coordinator", "Leader"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { is_rescheduled, rescheduled_date, rescheduled_time, reschedule_reason, location } = req.body;

    const current = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Small group not found" });

    await db.run(`
      UPDATE bible_study_groups
      SET is_rescheduled = $1,
          rescheduled_date = $2,
          rescheduled_time = $3,
          reschedule_reason = $4,
          location = COALESCE($5, location)
      WHERE id = $6
    `, [
      Boolean(is_rescheduled),
      is_rescheduled ? (rescheduled_date || null) : null,
      is_rescheduled ? (rescheduled_time || null) : null,
      is_rescheduled ? (reschedule_reason || null) : null,
      location ? location.trim() : null,
      id
    ]);

    const auditActionText = is_rescheduled
      ? `Rescheduled session for ${current.name} to ${rescheduled_date} (${rescheduled_time || "TBD"}) - Reason: ${reschedule_reason || "None"}`
      : `Reverted ${current.name} back to regular schedule (${current.meeting_day} ${current.meeting_time})`;

    await logAuditAction(
      req.user?.id || null,
      "RESCHEDULE_SESSION",
      "bible_study_groups",
      Number(id),
      auditActionText
    );

    emitRealtimeEvent("groups:changed", { action: "reschedule", id: Number(id) });

    res.json({
      message: is_rescheduled
        ? `Session successfully rescheduled to ${rescheduled_date}!`
        : "Reverted to regular weekly meeting schedule.",
      is_rescheduled: Boolean(is_rescheduled)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete group
router.delete("/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    await db.run("DELETE FROM bible_study_members WHERE group_id = $1", [id]);
    await db.run("DELETE FROM bible_study_groups WHERE id = $1", [id]);

    await logAuditAction(req.user?.id || null, "DELETE", "bible_study_groups", Number(id), `Deleted small group #${id}`);
    emitRealtimeEvent("groups:changed", { action: "delete", id: Number(id) });
    res.json({ message: "Small group deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Join group (Single or Multiple members batch)
router.post("/:id/join", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const groupId = req.params.id;
    const { member_id, member_ids, member_name } = req.body;

    const idsToJoin: number[] = Array.isArray(member_ids)
      ? member_ids.map(Number).filter(Boolean)
      : member_id
      ? [Number(member_id)]
      : [];

    if (idsToJoin.length > 0) {
      let addedCount = 0;
      for (const mId of idsToJoin) {
        const member = await db.get("SELECT first_name, last_name FROM members WHERE id = $1", [mId]);
        const mName = member ? `${member.first_name} ${member.last_name}` : "Member";
        await db.run(`
          INSERT INTO bible_study_members (group_id, member_id, member_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (group_id, member_id) DO NOTHING
        `, [groupId, mId, mName]);
        addedCount++;
      }

      emitRealtimeEvent("groups:changed", { action: "join", id: Number(groupId) });
      return res.json({
        message: addedCount === 1
          ? "Disciple added to group successfully!"
          : `Added ${addedCount} disciples to group successfully!`
      });
    }

    let targetMemberId = member_id;
    let targetName = member_name;

    if (!targetMemberId && req.user) {
      const linkedMember = await db.get("SELECT * FROM members WHERE user_id = $1", [req.user.id]);
      if (linkedMember) {
        targetMemberId = linkedMember.id;
        targetName = `${linkedMember.first_name} ${linkedMember.last_name}`;
      } else {
        targetName = req.user.name;
      }
    }

    if (targetMemberId) {
      const existing = await db.get("SELECT * FROM bible_study_members WHERE group_id = $1 AND member_id = $2", [groupId, targetMemberId]);
      if (existing) {
        return res.status(400).json({ error: "You are already a member of this small group." });
      }
    }

    await db.run(`
      INSERT INTO bible_study_members (group_id, member_id, member_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (group_id, member_id) DO NOTHING
    `, [groupId, targetMemberId || null, targetName || "Member"]);

    emitRealtimeEvent("groups:changed", { action: "join", id: Number(groupId) });

    res.json({ message: "Joined small group successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// BIBLE STUDY ATTENDANCE MONITOR & HISTORY ENDPOINTS
// =========================================================================

// Get comprehensive attendance statistics, history, and absentee breakdown for a group
router.get("/:id/attendance", async (req: Request, res: Response) => {
  try {
    const groupId = Number(req.params.id);

    const group = await db.get(`
      SELECT g.*, min.name as ministry_name, min.color as ministry_color
      FROM bible_study_groups g
      LEFT JOIN ministries min ON g.ministry_id = min.id
      WHERE g.id = $1
    `, [groupId]);

    if (!group) {
      return res.status(404).json({ error: "Small group not found" });
    }

    // 1. Fetch group members
    const groupMembers = await db.all(`
      SELECT bsm.member_id, bsm.member_name, bsm.joined_at,
             m.first_name, m.last_name, m.contact_phone, m.contact_email, m.photo_url,
             m.ministry_id, min.name as ministry_name, min.color as ministry_color
      FROM bible_study_members bsm
      LEFT JOIN members m ON bsm.member_id = m.id
      LEFT JOIN ministries min ON m.ministry_id = min.id
      WHERE bsm.group_id = $1
      ORDER BY COALESCE(LOWER(m.first_name), LOWER(bsm.member_name)) ASC, LOWER(m.last_name) ASC
    `, [groupId]);

    // 2. Fetch recorded sessions for this group (supports limit and offset pagination)
    const limit = req.query.limit ? Math.max(1, parseInt(String(req.query.limit), 10)) : null;
    const offset = req.query.offset ? Math.max(0, parseInt(String(req.query.offset), 10)) : 0;

    let sessionsQuery = `
      SELECT s.*, u.name as recorded_by_name
      FROM bible_study_sessions s
      LEFT JOIN users u ON s.recorded_by = u.id
      WHERE s.group_id = $1
      ORDER BY s.session_date DESC
    `;
    const sessionsParams: any[] = [groupId];

    if (limit !== null) {
      sessionsParams.push(limit, offset);
      sessionsQuery += ` LIMIT $2 OFFSET $3`;
    }

    const sessions = await db.all(sessionsQuery, sessionsParams);

    // 3. Fetch all attendance logs for this group
    const attendanceLogs = await db.all(`
      SELECT a.*, m.first_name, m.last_name, m.photo_url, m.contact_phone
      FROM bible_study_attendance a
      JOIN members m ON a.member_id = m.id
      WHERE a.group_id = $1
      ORDER BY a.session_date DESC
    `, [groupId]);

    // Map logs by session_date & member_id
    const logsBySession = new Map<string, any[]>();
    const logsByMember = new Map<number, any[]>();

    for (const log of attendanceLogs) {
      const dateStr = log.session_date instanceof Date ? log.session_date.toISOString().split("T")[0] : String(log.session_date).split("T")[0];
      
      if (!logsBySession.has(dateStr)) logsBySession.set(dateStr, []);
      logsBySession.get(dateStr)!.push(log);

      if (!logsByMember.has(log.member_id)) logsByMember.set(log.member_id, []);
      logsByMember.get(log.member_id)!.push({
        ...log,
        session_date: dateStr
      });
    }

    // Total distinct sessions recorded
    const totalSessions = sessions.length;

    // Detailed member absentee and attendance calculation
    let totalPresentSum = 0;
    let totalAbsentSum = 0;
    let atRiskCount = 0;

    const membersStats = groupMembers.map((m) => {
      const memId = m.member_id;
      const memLogs = logsByMember.get(memId) || [];

      const logMap = new Map<string, any>();
      for (const l of memLogs) {
        logMap.set(l.session_date, l);
      }

      let presentCount = 0;
      let absentCount = 0;
      let excusedCount = 0;

      // History across all sessions
      const history = sessions.map((s) => {
        const sDateStr = s.session_date instanceof Date ? s.session_date.toISOString().split("T")[0] : String(s.session_date).split("T")[0];
        const record = logMap.get(sDateStr);
        let status = record ? record.status : "absent"; // if session held without explicit record, counted as absent
        
        if (status === "present") presentCount++;
        else if (status === "excused") excusedCount++;
        else absentCount++;

        return {
          session_date: sDateStr,
          topic_title: s.topic_title || group.curriculum || "Weekly Bible Study",
          chapter: s.chapter || group.current_chapter || "Session",
          status,
          notes: record?.notes || s.notes || ""
        };
      });

      totalPresentSum += presentCount;
      totalAbsentSum += absentCount;

      const rate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

      // Check consecutive absences from most recent sessions
      let consecutiveAbsences = 0;
      for (const h of history) {
        if (h.status === "absent") {
          consecutiveAbsences++;
        } else {
          break;
        }
      }

      let healthStatus: "consistent" | "moderate" | "at_risk" = "consistent";
      if (absentCount >= 3 || consecutiveAbsences >= 2 || (totalSessions >= 3 && rate < 60)) {
        healthStatus = "at_risk";
        atRiskCount++;
      } else if (absentCount > 0) {
        healthStatus = "moderate";
      }

      return {
        member_id: memId,
        display_name: m.first_name ? `${m.first_name} ${m.last_name}` : m.member_name || "Disciple",
        first_name: m.first_name,
        last_name: m.last_name,
        contact_phone: m.contact_phone,
        contact_email: m.contact_email,
        photo_url: m.photo_url,
        ministry_name: m.ministry_name,
        ministry_color: m.ministry_color,
        joined_at: m.joined_at,
        total_sessions: totalSessions,
        present_count: presentCount,
        absent_count: absentCount,
        excused_count: excusedCount,
        consecutive_absences: consecutiveAbsences,
        attendance_rate: rate,
        health_status: healthStatus,
        history
      };
    });

    // Detailed sessions list with attendees vs absentees
    const detailedSessions = sessions.map((s) => {
      const sDateStr = s.session_date instanceof Date ? s.session_date.toISOString().split("T")[0] : String(s.session_date).split("T")[0];
      const sLogs = logsBySession.get(sDateStr) || [];

      const attendees: any[] = [];
      const absentees: any[] = [];
      const excused: any[] = [];

      const logMemberMap = new Map<number, any>();
      for (const l of sLogs) {
        logMemberMap.set(l.member_id, l);
      }

      for (const gm of groupMembers) {
        const rec = logMemberMap.get(gm.member_id);
        const memObj = {
          member_id: gm.member_id,
          name: gm.first_name ? `${gm.first_name} ${gm.last_name}` : gm.member_name || "Member",
          photo_url: gm.photo_url,
          contact_phone: gm.contact_phone,
          status: rec ? rec.status : "absent",
          notes: rec?.notes || ""
        };

        if (rec && rec.status === "present") attendees.push(memObj);
        else if (rec && rec.status === "excused") excused.push(memObj);
        else absentees.push(memObj);
      }

      return {
        id: s.id,
        session_date: sDateStr,
        topic_title: s.topic_title || group.curriculum || "Weekly Session",
        chapter: s.chapter || group.current_chapter || "Chapter 1",
        notes: s.notes || "",
        is_special: Boolean(s.is_special),
        special_reason: s.special_reason || null,
        recorded_by_name: s.recorded_by_name || "Leader",
        present_count: attendees.length,
        absent_count: absentees.length,
        excused_count: excused.length,
        total_enrolled: groupMembers.length,
        attendees,
        absentees,
        excused
      };
    });

    const totalPossibleSlots = totalSessions * groupMembers.length;
    const overallRate = totalPossibleSlots > 0 ? Math.round((totalPresentSum / totalPossibleSlots) * 100) : 100;

    res.json({
      group,
      summary: {
        total_sessions: totalSessions,
        total_enrolled: groupMembers.length,
        overall_attendance_rate: overallRate,
        total_absences: totalAbsentSum,
        total_presents: totalPresentSum,
        at_risk_count: atRiskCount,
        average_attendees_per_session: totalSessions > 0 ? (totalPresentSum / totalSessions).toFixed(1) : "0"
      },
      members: membersStats,
      sessions: detailedSessions
    });
  } catch (err: any) {
    console.error("Failed to load group attendance data:", err);
    res.status(500).json({ error: "Failed to load group attendance data: " + err.message });
  }
});

// Save or Update attendance session
router.post("/:id/attendance", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const groupId = Number(req.params.id);
    const {
      session_date,
      topic_title,
      chapter,
      notes,
      records,
      present_member_ids,
      is_special,
      special_reason
    } = req.body;

    if (!session_date) {
      return res.status(400).json({ error: "session_date is required (YYYY-MM-DD)" });
    }

    const group = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [groupId]);
    if (!group) {
      return res.status(404).json({ error: "Small group not found" });
    }

    // 1. Validate date is not in future (Asia/Manila time)
    const todayManila = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    const [mm, dd, yyyy] = todayManila.split("/");
    const todayManilaYMD = `${yyyy}-${mm}-${dd}`;

    if (session_date > todayManilaYMD) {
      return res.status(400).json({ error: "Cannot record or update attendance for future dates." });
    }

    // 2. Validate schedule matching unless is_special = true
    const isSpecialBool = Boolean(is_special);
    const cleanReason = special_reason ? String(special_reason).trim() : null;

    const DAY_MAP: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
    };

    if (!isSpecialBool) {
      if (group.meeting_day && DAY_MAP[group.meeting_day.trim().toLowerCase()] !== undefined) {
        const [sY, sM, sD] = session_date.split("-").map(Number);
        const sessionDayIdx = new Date(Date.UTC(sY, sM - 1, sD)).getUTCDay();
        const targetDayIdx = DAY_MAP[group.meeting_day.trim().toLowerCase()];

        if (sessionDayIdx !== targetDayIdx) {
          return res.status(400).json({
            error: `Selected date (${session_date}) does not match the group's regular schedule (${group.meeting_day}). Please mark as a special session with a reason if this was a reschedule.`
          });
        }
      }
    } else {
      if (!cleanReason) {
        return res.status(400).json({
          error: "A reason is required when logging a special / rescheduled session (e.g. makeup class, holiday shift)."
        });
      }
    }

    // 3. Upsert session record
    await db.run(`
      INSERT INTO bible_study_sessions (group_id, session_date, topic_title, chapter, notes, is_special, special_reason, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (group_id, session_date) DO UPDATE SET
        topic_title = EXCLUDED.topic_title,
        chapter = EXCLUDED.chapter,
        notes = EXCLUDED.notes,
        is_special = EXCLUDED.is_special,
        special_reason = EXCLUDED.special_reason,
        recorded_by = EXCLUDED.recorded_by
    `, [
      groupId,
      session_date,
      topic_title || group.curriculum || "Weekly Bible Study",
      chapter || group.current_chapter || "Chapter 1",
      notes || "",
      isSpecialBool,
      cleanReason,
      req.user?.id || null
    ]);

    // 2. Fetch all group members
    const groupMembers = await db.all<{ member_id: number }>(
      "SELECT member_id FROM bible_study_members WHERE group_id = $1",
      [groupId]
    );

    // 3. Process records
    if (Array.isArray(records) && records.length > 0) {
      for (const rec of records) {
        await db.run(`
          INSERT INTO bible_study_attendance (group_id, session_date, member_id, status, notes, recorded_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (group_id, session_date, member_id) DO UPDATE SET
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            recorded_by = EXCLUDED.recorded_by
        `, [
          groupId,
          session_date,
          rec.member_id,
          rec.status || "present",
          rec.notes || "",
          req.user?.id || null
        ]);
      }
    } else if (Array.isArray(present_member_ids)) {
      const presentSet = new Set(present_member_ids.map(Number));
      for (const gm of groupMembers) {
        if (!gm.member_id) continue;
        const status = presentSet.has(gm.member_id) ? "present" : "absent";
        await db.run(`
          INSERT INTO bible_study_attendance (group_id, session_date, member_id, status, notes, recorded_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (group_id, session_date, member_id) DO UPDATE SET
            status = EXCLUDED.status,
            recorded_by = EXCLUDED.recorded_by
        `, [
          groupId,
          session_date,
          gm.member_id,
          status,
          "",
          req.user?.id || null
        ]);
      }
    }

    await logAuditAction(
      req.user?.id || null,
      "CREATE",
      "bible_study_attendance",
      groupId,
      `Recorded Bible Study attendance session for ${group.name} on ${session_date}`
    );

    emitRealtimeEvent("attendance:changed", { action: "save_session", group_id: groupId, session_date });
    emitRealtimeEvent("groups:changed", { action: "attendance_update", id: groupId });

    res.json({ message: `✓ Attendance session for ${session_date} logged successfully!` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete attendance session
router.delete("/:id/attendance/:date", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const groupId = Number(req.params.id);
    const date = req.params.date;

    await db.run("DELETE FROM bible_study_attendance WHERE group_id = $1 AND session_date = $2", [groupId, date]);
    await db.run("DELETE FROM bible_study_sessions WHERE group_id = $1 AND session_date = $2", [groupId, date]);

    emitRealtimeEvent("attendance:changed", { action: "delete_session", group_id: groupId, session_date: date });
    emitRealtimeEvent("groups:changed", { action: "attendance_update", id: groupId });

    res.json({ message: "Attendance session removed successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;


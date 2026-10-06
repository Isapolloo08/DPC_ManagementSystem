import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";
import { resolveTotalChapters } from "./studyTopics";
import { notify } from "../services/notificationService";
import { countConsecutiveAbsences } from "../utils/groupAttendanceIntelligence";
import { MY_GROUP_SCOPE, MY_GROUP_LEADER_SCOPE } from "../utils/myGroupScope";

const router = Router();

interface GroupNotificationRow {
  id: number;
  name: string;
  ministry_id: number | null;
  leader_name: string | null;
  leader_contact: string | null;
  curriculum: string | null;
  meeting_day: string;
  meeting_time: string;
}

function htmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendAbsenceSessionNotification(groupId: number, sessionDate: string): Promise<void> {
  try {
    const group = await db.get<GroupNotificationRow>("SELECT id, name, ministry_id, leader_name, leader_contact, curriculum, meeting_day, meeting_time FROM bible_study_groups WHERE id = $1", [groupId]);
    const session = await db.get<{ id: number; topic_title: string | null }>(
      "SELECT id, topic_title FROM bible_study_sessions WHERE group_id = $1 AND session_date = $2",
      [groupId, sessionDate]
    );
    if (!group || !session) return;

    const absentMembers = await db.all<{ member_id: number; display_name: string }>(`
      SELECT bsa.member_id, COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), bsm.member_name, 'Disciple') AS display_name
      FROM bible_study_attendance bsa
      LEFT JOIN members m ON m.id = bsa.member_id
      LEFT JOIN bible_study_members bsm ON bsm.group_id = bsa.group_id AND bsm.member_id = bsa.member_id
      WHERE bsa.group_id = $1 AND bsa.session_date = $2 AND bsa.status = 'absent'
      ORDER BY display_name ASC
    `, [groupId, sessionDate]);
    if (absentMembers.length === 0) return;

    const thresholdRow = await db.get<{ threshold: number | null }>(`
      SELECT threshold FROM notification_rules
      WHERE event_type = 'absence_alert' AND enabled = TRUE AND threshold IS NOT NULL
      ORDER BY threshold ASC LIMIT 1
    `);
    const threshold = Number(thresholdRow?.threshold || 3);
    const absentIds = absentMembers.map(member => member.member_id);
    const history = await db.all<{ member_id: number; session_date: string; status: string }>(`
      SELECT member_id, session_date, status
      FROM bible_study_attendance
      WHERE group_id = $1 AND member_id = ANY($2::int[]) AND session_date <= $3
      ORDER BY member_id ASC, session_date DESC
    `, [groupId, absentIds, sessionDate]);
    const histories = new Map<number, typeof history>();
    for (const item of history) {
      const list = histories.get(item.member_id) || [];
      list.push(item);
      histories.set(item.member_id, list);
    }
    const streaks = new Map(absentMembers.map(member => [member.member_id, countConsecutiveAbsences(histories.get(member.member_id) || [])]));
    const absentLines = absentMembers.map(member => {
      const streak = streaks.get(member.member_id) || 0;
      return streak >= threshold ? `${member.display_name} (${streak} consecutive absences — attention needed)` : member.display_name;
    });
    const topic = session.topic_title || group.curriculum || "Weekly Bible Study";
    const message = `${group.name} attendance for ${sessionDate}\nTopic: ${topic}\nAbsent: ${absentLines.join(", ")}`;
    const listHtml = absentMembers.map(member => {
      const streak = streaks.get(member.member_id) || 0;
      const flag = streak >= threshold ? ` <strong style="color:#b45309">(${streak} consecutive absences)</strong>` : "";
      return `<li>${htmlEscape(member.display_name)}${flag}</li>`;
    }).join("");

    await notify("absence_alert", {
      eventKey: `group-session:${session.id}`,
      title: `Absence summary: ${group.name}`,
      message,
      linkTab: "biblestudy",
      linkRefId: groupId,
      ministryId: group.ministry_id,
      emailSubject: `Bible Study absence summary — ${group.name} — ${sessionDate}`,
      emailHtml: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${htmlEscape(group.name)}</h2><p><strong>Date:</strong> ${htmlEscape(sessionDate)}<br><strong>Topic:</strong> ${htmlEscape(topic)}</p><p>The following disciples were marked absent:</p><ul>${listHtml}</ul><p style="font-size:12px;color:#64748b">This message contains private attendance information and was sent only to configured church recipients.</p></div>`
    });
  } catch (error) {
    console.error("Failed to prepare absence notification:", error);
  }
}

async function sendRescheduleNotification(group: GroupNotificationRow, date: string | null, time: string | null, reason: string | null): Promise<void> {
  try {
    const memberUsers = await db.all<{ id: number }>(`
      SELECT DISTINCT m.user_id AS id
      FROM bible_study_members bsm
      JOIN members m ON m.id = bsm.member_id
      WHERE bsm.group_id = $1 AND m.user_id IS NOT NULL
    `, [group.id]);
    const leaderUsers = await db.all<{ id: number }>(`
      SELECT DISTINCT u.id
      FROM users u
      LEFT JOIN members m ON m.user_id = u.id
      WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(COALESCE($1, '')))
         OR LOWER(TRIM(u.name)) = LOWER(TRIM(COALESCE($2, '')))
         OR LOWER(TRIM(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, ''))) = LOWER(TRIM(COALESCE($2, '')))
    `, [group.leader_contact, group.leader_name]);
    const memberIds = memberUsers.map(user => user.id);
    const leaderIds = leaderUsers.map(user => user.id);
    const message = `${group.name} has been rescheduled to ${date || "a date to be announced"}${time ? ` at ${time}` : ""}.${reason ? ` Reason: ${reason}` : ""}`;
    await notify("session_rescheduled", {
      eventKey: `group:${group.id}:${date || "tbd"}:${time || "tbd"}:${reason || "none"}`,
      title: `Session rescheduled: ${group.name}`,
      message,
      linkTab: "biblestudy",
      linkRefId: group.id,
      ministryId: group.ministry_id,
      roleUserIds: { Member: memberIds, Leader: leaderIds },
      emailSubject: `Schedule update — ${group.name}`
    });
  } catch (error) {
    console.error("Failed to prepare reschedule notification:", error);
  }
}

// List Bible study groups with members
router.get("/mine", authMiddleware, listGroups);
router.get("/", listGroups);

async function listGroups(req: AuthRequest, res: Response) {
  try {
    const { ministry_id, category, meeting_day, search, page, limit } = req.query;
    const mine = req.route.path === "/mine";
    const status = mine ? "active" : req.query.status;

    let whereClause = " WHERE 1=1";
    const params: any[] = [];

    if (mine) {
      // Identity comes only from the authenticated account, regardless of role.
      if (!req.user) return res.status(401).json({ error: "Authentication required" });
      params.push(req.user.id);
      whereClause += ` AND ${MY_GROUP_SCOPE}`;
    }

    if (ministry_id) {
      params.push(ministry_id);
      whereClause += ` AND g.ministry_id = $${params.length}`;
    }

    if (category) {
      params.push(category);
      whereClause += ` AND g.category = $${params.length}`;
    }

    if (meeting_day) {
      params.push(meeting_day);
      whereClause += ` AND g.meeting_day = $${params.length}`;
    }

    if (status && typeof status === "string" && status.trim()) {
      const s = status.trim().toLowerCase();
      if (s === "active") {
        whereClause += ` AND COALESCE(g.status, 'active') = 'active'`;
      } else if (s === "completed") {
        whereClause += ` AND g.status = 'completed'`;
      } else if (s === "archived") {
        whereClause += ` AND g.status = 'archived'`;
      } else if (s === "merged") {
        whereClause += ` AND g.status = 'merged'`;
      } else if (s === "all") {
        // "All" visible lifecycle includes active, completed, and archived (excludes merged source groups)
        whereClause += ` AND COALESCE(g.status, 'active') IN ('active', 'completed', 'archived')`;
      } else {
        params.push(s);
        whereClause += ` AND g.status = $${params.length}`;
      }
    } else {
      // Default: exclude internal merged source groups
      whereClause += ` AND COALESCE(g.status, 'active') IN ('active', 'completed', 'archived')`;
    }

    if (search && typeof search === "string" && search.trim()) {
      params.push(`%${search.trim()}%`);
      const pIdx = params.length;
      whereClause += ` AND (g.name ILIKE $${pIdx} OR g.leader_name ILIKE $${pIdx} OR g.curriculum ILIKE $${pIdx} OR g.location ILIKE $${pIdx} OR COALESCE(g.assistant_leader_name, '') ILIKE $${pIdx})`;
    }

    const isPaginated = page !== undefined || limit !== undefined;
    let totalCount = 0;
    const curPage = Math.max(1, page ? parseInt(String(page), 10) : 1);
    const curLimit = Math.min(100, Math.max(1, limit ? parseInt(String(limit), 10) : 20));

    if (isPaginated) {
      const countRes = await db.get<{ total: string | number }>(`
        SELECT COUNT(*) as total FROM bible_study_groups g ${whereClause}
      `, params);
      totalCount = parseInt(String(countRes?.total || 0), 10);
    }

    let query = `
      SELECT g.id, g.name, g.description, g.curriculum, g.ministry_id, g.leader_name,
             g.leader_contact, g.meeting_day, g.meeting_time, g.location, g.category,
             g.max_capacity, g.created_at, g.current_chapter, g.progress_stage, g.progress_notes,
             g.is_rescheduled, g.rescheduled_date, g.rescheduled_time, g.reschedule_reason,
             COALESCE(g.status, 'active') as status, g.merged_into_group_id, g.closed_at, g.effective_date,
             g.assistant_leader_name, g.assistant_leader_contact, g.assistant_leader_id,
             g.completed_at, g.completed_book_id, g.completed_book_title_snapshot,
             g.completed_chapter, g.completed_total_chapters,
             g.archived_at, g.archived_by, g.archive_reason,
             u_arch.name as archived_by_name,
             min.name as ministry_name, min.color as ministry_color,
             mg.name as merged_into_group_name,
             (SELECT COUNT(*) FROM bible_study_members WHERE group_id = g.id AND COALESCE(status, 'active') = 'active') as current_member_count
      FROM bible_study_groups g
      LEFT JOIN ministries min ON g.ministry_id = min.id
      LEFT JOIN bible_study_groups mg ON g.merged_into_group_id = mg.id
      LEFT JOIN users u_arch ON g.archived_by = u_arch.id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN COALESCE(g.status, 'active') = 'active' THEN 0 
          WHEN g.status = 'completed' THEN 1
          WHEN g.status = 'archived' THEN 2
          ELSE 3 
        END ASC,
        COALESCE(g.completed_at, g.archived_at, g.created_at) DESC,
        g.id ASC
    `;

    let groups: any[] = [];
    if (isPaginated) {
      const offset = (curPage - 1) * curLimit;
      const paginatedParams = [...params, curLimit, offset];
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      groups = await db.all(query, paginatedParams);
    } else {
      groups = await db.all(query, params);
    }

    const groupIds = groups.map(g => g.id);
    const [dbTopics, allGroupMembers, allTransitions] = await Promise.all([
      db.all<{ title: string; total_chapters: number }>("SELECT title, total_chapters FROM bible_study_topics").catch(() => []),
      groupIds.length > 0 ? db.all(`
        SELECT bsm.id, bsm.group_id, bsm.member_id, bsm.member_name, bsm.joined_at, bsm.status as member_status,
               m.first_name, m.last_name, m.contact_email, m.contact_phone
        FROM bible_study_members bsm
        LEFT JOIN members m ON bsm.member_id = m.id
        WHERE bsm.group_id = ANY($1)
        ORDER BY COALESCE(LOWER(m.first_name), LOWER(bsm.member_name)) ASC, LOWER(m.last_name) ASC
      `, [groupIds]) : Promise.resolve([]),
      groupIds.length > 0 ? db.all(`
        SELECT t.id, t.transition_type, t.new_group_id, t.effective_date, t.reason, t.notes, t.created_at,
               u.name as created_by_name,
               (
                 SELECT json_agg(json_build_object('id', sg.id, 'name', sg.name, 'leader_name', sg.leader_name, 'status', sg.status))
                 FROM bible_study_group_transition_sources ts
                 JOIN bible_study_groups sg ON ts.source_group_id = sg.id
                 WHERE ts.transition_id = t.id
               ) as source_groups
        FROM bible_study_group_transitions t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.new_group_id = ANY($1)
      `, [groupIds]).catch(() => []) : Promise.resolve([])
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

    const transitionsByNewGroup = new Map<number, any>();
    for (const t of allTransitions) {
      if (t.new_group_id) {
        transitionsByNewGroup.set(t.new_group_id, t);
      }
    }

    const detailed = groups.map((g) => {
      const members = membersByGroup.get(g.id) || [];
      const totalChapters = g.completed_total_chapters || resolveTotalChapters(g.completed_book_title_snapshot || g.curriculum || "", dbTopics);
      const createdTransition = transitionsByNewGroup.get(g.id) || null;

      return {
        ...g,
        curriculum_total_chapters: totalChapters,
        current_member_count: members.filter(m => m.member_status !== 'transferred').length || Number(g.current_member_count || 0),
        members,
        created_transition: createdTransition
      };
    });

    res.json(detailed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// =========================================================================
// BIBLE STUDY GROUP TRANSITIONS ENDPOINTS
// =========================================================================

// POST /api/groups/transitions/merge — Merge two or more groups into a new group
router.post("/transitions/merge", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const {
      source_group_ids,
      new_group_name,
      description,
      curriculum,
      ministry_id,
      primary_leader_name,
      primary_leader_contact,
      primary_leader_id,
      assistant_leader_name,
      assistant_leader_contact,
      assistant_leader_id,
      meeting_day,
      meeting_time,
      location,
      category = "General",
      max_capacity = 12,
      effective_date,
      reason,
      notes
    } = req.body;

    // 1. Validation: source_group_ids
    if (!Array.isArray(source_group_ids) || source_group_ids.length < 2) {
      return res.status(400).json({ error: "At least two Bible study groups are required to perform a merge." });
    }

    const uniqueSourceIds = Array.from(new Set(source_group_ids.map(Number).filter(Boolean)));
    if (uniqueSourceIds.length < 2) {
      return res.status(400).json({ error: "Please select at least two distinct Bible study groups." });
    }

    // 2. Validation: new_group_name
    if (!new_group_name || !new_group_name.trim()) {
      return res.status(400).json({ error: "Resulting group name is required." });
    }

    // Check if another active group already has this name
    const existingGroup = await db.get(
      "SELECT id, name FROM bible_study_groups WHERE LOWER(name) = LOWER($1) AND COALESCE(status, 'active') != 'merged'",
      [new_group_name.trim()]
    );
    if (existingGroup) {
      return res.status(400).json({ error: `An active Bible study group named "${new_group_name.trim()}" already exists.` });
    }

    // 3. Validation: leaders
    if (!primary_leader_name || !primary_leader_name.trim()) {
      return res.status(400).json({ error: "Primary Leader is required for the merged group." });
    }

    const cleanPrimary = primary_leader_name.trim();
    const cleanAssistant = assistant_leader_name && assistant_leader_name.trim() ? assistant_leader_name.trim() : null;

    if (cleanAssistant) {
      if (cleanPrimary.toLowerCase() === cleanAssistant.toLowerCase()) {
        return res.status(400).json({ error: "Primary Leader and Assistant Leader cannot be the same person." });
      }
      if (primary_leader_id && assistant_leader_id && Number(primary_leader_id) === Number(assistant_leader_id)) {
        return res.status(400).json({ error: "Primary Leader and Assistant Leader cannot be the same person." });
      }
    }

    // 4. Validate source groups existence and status
    const sourceGroups = await db.all<any>(
      "SELECT * FROM bible_study_groups WHERE id = ANY($1)",
      [uniqueSourceIds]
    );

    if (sourceGroups.length !== uniqueSourceIds.length) {
      return res.status(400).json({ error: "One or more selected source groups could not be found." });
    }

    for (const sg of sourceGroups) {
      if (sg.status === "merged") {
        return res.status(400).json({
          error: `Group "${sg.name}" has already been merged into another group and cannot be merged again.`
        });
      }
    }

    // 5. Resolve effective date
    const effDate = (effective_date && typeof effective_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(effective_date))
      ? effective_date
      : new Date().toISOString().split("T")[0];

    // Defaults from source groups if not provided
    const resolvedMeetingDay = meeting_day || sourceGroups[0].meeting_day || "Wednesday";
    const resolvedMeetingTime = meeting_time || sourceGroups[0].meeting_time || "7:00 PM - 8:30 PM";
    const resolvedLocation = location || sourceGroups[0].location || "Fellowship Hall Room 201";
    const resolvedCurriculum = curriculum || sourceGroups[0].curriculum || "General Scripture Study";
    const resolvedMinistryId = ministry_id !== undefined ? (ministry_id ? Number(ministry_id) : null) : sourceGroups[0].ministry_id;
    const resolvedCapacity = Number(max_capacity) || Math.max(12, sourceGroups.reduce((s: number, g: any) => s + (g.max_capacity || 12), 0));

    // 6. Execute PostgreSQL transaction
    let newGroupId: number = 0;
    let transitionId: number = 0;
    let migratedMemberCount: number = 0;

    await db.transaction(async (client) => {
      // Step A: Insert resulting group
      const newGroupRes = await client.query(`
        INSERT INTO bible_study_groups (
          name, description, curriculum, ministry_id, leader_name, leader_contact,
          assistant_leader_name, assistant_leader_contact, assistant_leader_id,
          meeting_day, meeting_time, location, category, max_capacity,
          current_chapter, progress_stage, progress_notes, status, effective_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'active', $18)
        RETURNING id
      `, [
        new_group_name.trim(),
        description ? description.trim() : `Merged group from ${sourceGroups.map((g: any) => g.name).join(" + ")}`,
        resolvedCurriculum,
        resolvedMinistryId,
        cleanPrimary,
        primary_leader_contact ? primary_leader_contact.trim() : null,
        cleanAssistant,
        assistant_leader_contact ? assistant_leader_contact.trim() : null,
        assistant_leader_id ? Number(assistant_leader_id) : null,
        resolvedMeetingDay,
        resolvedMeetingTime,
        resolvedLocation,
        category,
        resolvedCapacity,
        sourceGroups[0].current_chapter || "Chapter 1",
        "in_progress",
        notes ? notes.trim() : `Group created through merge transition on ${effDate}. Reason: ${reason || "Restructuring"}`,
        effDate
      ]);

      newGroupId = newGroupRes.rows[0].id;

      // Step B: Insert master transition record
      const transRes = await client.query(`
        INSERT INTO bible_study_group_transitions (
          transition_type, new_group_id, effective_date, reason, notes, metadata, created_by
        )
        VALUES ('MERGE', $1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        newGroupId,
        effDate,
        reason ? reason.trim() : "Group restructuring",
        notes ? notes.trim() : null,
        JSON.stringify({
          source_group_ids: uniqueSourceIds,
          source_groups: sourceGroups.map((g: any) => ({ id: g.id, name: g.name, leader_name: g.leader_name })),
          primary_leader: cleanPrimary,
          assistant_leader: cleanAssistant
        }),
        req.user?.id || null
      ]);

      transitionId = transRes.rows[0].id;

      // Step C: Insert transition source links
      for (const sgId of uniqueSourceIds) {
        await client.query(`
          INSERT INTO bible_study_group_transition_sources (transition_id, source_group_id)
          VALUES ($1, $2)
          ON CONFLICT (transition_id, source_group_id) DO NOTHING
        `, [transitionId, sgId]);
      }

      // Step D: Collect all distinct active members from source groups
      const sourceMembersRes = await client.query(`
        SELECT DISTINCT ON (COALESCE(member_id, 0), LOWER(TRIM(member_name)))
          member_id, member_name
        FROM bible_study_members
        WHERE group_id = ANY($1)
      `, [uniqueSourceIds]);

      const distinctMembers = sourceMembersRes.rows;
      migratedMemberCount = distinctMembers.length;

      // Step E: Copy members into new group with status = 'active'
      for (const m of distinctMembers) {
        await client.query(`
          INSERT INTO bible_study_members (group_id, member_id, member_name, status, joined_at, transition_id)
          VALUES ($1, $2, $3, 'active', $4, $5)
          ON CONFLICT (group_id, member_id) DO UPDATE SET
            status = 'active',
            transition_id = EXCLUDED.transition_id
        `, [newGroupId, m.member_id || null, m.member_name || "Member", effDate, transitionId]);
      }

      // Step F: Mark source group memberships as transferred (preserving history)
      await client.query(`
        UPDATE bible_study_members
        SET status = 'transferred', left_at = CURRENT_TIMESTAMP, transition_id = $1
        WHERE group_id = ANY($2)
      `, [transitionId, uniqueSourceIds]);

      // Step G: Record Primary and Assistant Leaders in bible_study_group_leaders
      await client.query(`
        INSERT INTO bible_study_group_leaders (group_id, leader_name, leader_contact, role, started_at, status)
        VALUES ($1, $2, $3, 'primary', $4, 'active')
      `, [newGroupId, cleanPrimary, primary_leader_contact ? primary_leader_contact.trim() : null, effDate]);

      if (cleanAssistant) {
        await client.query(`
          INSERT INTO bible_study_group_leaders (group_id, leader_name, leader_contact, role, started_at, status)
          VALUES ($1, $2, $3, 'assistant', $4, 'active')
        `, [newGroupId, cleanAssistant, assistant_leader_contact ? assistant_leader_contact.trim() : null, effDate]);
      }

      // Record former leaders of source groups
      for (const sg of sourceGroups) {
        if (
          sg.leader_name &&
          sg.leader_name.trim().toLowerCase() !== cleanPrimary.toLowerCase() &&
          (!cleanAssistant || sg.leader_name.trim().toLowerCase() !== cleanAssistant.toLowerCase())
        ) {
          await client.query(`
            INSERT INTO bible_study_group_leaders (group_id, leader_name, leader_contact, role, started_at, ended_at, status)
            VALUES ($1, $2, $3, 'former', $4, $4, 'inactive')
          `, [sg.id, sg.leader_name.trim(), sg.leader_contact || null, effDate]);
        }
      }

      // Step H: Mark source groups as MERGED into new group
      await client.query(`
        UPDATE bible_study_groups
        SET status = 'merged',
            merged_into_group_id = $1,
            closed_at = CURRENT_TIMESTAMP,
            effective_date = $2
        WHERE id = ANY($3)
      `, [newGroupId, effDate, uniqueSourceIds]);
    });

    // Step I: Audit Logging
    const sourceNames = sourceGroups.map((g: any) => g.name).join(", ");
    const auditDetails = `Action: BIBLE_STUDY_GROUP_MERGE\nPerformed by: ${req.user?.name || "Admin"}\nSource Groups: ${sourceNames}\nResulting Group: ${new_group_name.trim()}\nPrimary Leader: ${cleanPrimary}\nAssistant Leader: ${cleanAssistant || "None"}\nEffective Date: ${effDate}\nMigrated Members: ${migratedMemberCount}\nReason: ${reason || "Group restructuring"}`;

    await logAuditAction(
      req.user?.id || null,
      "BIBLE_STUDY_GROUP_MERGE",
      "bible_study_groups",
      newGroupId,
      auditDetails
    );

    // Step J: Real-time Socket.io updates
    emitRealtimeEvent("groups:changed", {
      action: "transition_merge",
      id: newGroupId,
      source_group_ids: uniqueSourceIds,
      new_group_name: new_group_name.trim()
    });
    emitRealtimeEvent("bible-study:changed", {
      action: "merge",
      new_group_id: newGroupId,
      source_group_ids: uniqueSourceIds
    });

    res.status(201).json({
      success: true,
      message: `✓ Successfully merged ${sourceGroups.length} groups into "${new_group_name.trim()}"! Combined ${migratedMemberCount} disciples.`,
      group_id: newGroupId,
      transition_id: transitionId,
      migrated_members: migratedMemberCount
    });
  } catch (err: any) {
    console.error("Failed to perform Bible Study group merge:", err);
    res.status(500).json({ error: err.message || "Failed to complete group merge transition." });
  }
});

// GET /api/groups/transitions — List all group transitions
router.get("/transitions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const transitions = await db.all(`
      SELECT t.*, u.name as created_by_name, bg.name as new_group_name,
             (
               SELECT json_agg(json_build_object('id', sg.id, 'name', sg.name, 'leader_name', sg.leader_name, 'status', sg.status))
               FROM bible_study_group_transition_sources ts
               JOIN bible_study_groups sg ON ts.source_group_id = sg.id
               WHERE ts.transition_id = t.id
             ) as source_groups
      FROM bible_study_group_transitions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN bible_study_groups bg ON t.new_group_id = bg.id
      ORDER BY t.effective_date DESC, t.id DESC
    `);
    res.json(transitions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/history — Get transition & leadership history for a specific group
router.get("/:id/history", async (req: Request, res: Response) => {
  try {
    const groupId = Number(req.params.id);
    const group = await db.get(`
      SELECT g.*, min.name as ministry_name, min.color as ministry_color
      FROM bible_study_groups g
      LEFT JOIN ministries min ON g.ministry_id = min.id
      WHERE g.id = $1
    `, [groupId]);

    if (!group) return res.status(404).json({ error: "Small group not found" });

    // Transition that created this group (e.g. this group was new_group_id in a merge)
    const createdTransition = await db.get(`
      SELECT t.*, u.name as created_by_name
      FROM bible_study_group_transitions t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.new_group_id = $1
      ORDER BY t.id DESC LIMIT 1
    `, [groupId]);

    let sourceGroups: any[] = [];
    if (createdTransition) {
      sourceGroups = await db.all(`
        SELECT sg.id, sg.name, sg.leader_name, sg.leader_contact, sg.category, sg.status, sg.meeting_day, sg.meeting_time,
               (SELECT COUNT(*) FROM bible_study_members WHERE group_id = sg.id) as member_count
        FROM bible_study_group_transition_sources ts
        JOIN bible_study_groups sg ON ts.source_group_id = sg.id
        WHERE ts.transition_id = $1
        ORDER BY sg.name ASC
      `, [createdTransition.id]);
    }

    // Target group if this group was merged into another
    let mergedIntoGroup = null;
    if (group.merged_into_group_id) {
      mergedIntoGroup = await db.get(`
        SELECT id, name, leader_name, leader_contact, assistant_leader_name, status, meeting_day, meeting_time, location
        FROM bible_study_groups
        WHERE id = $1
      `, [group.merged_into_group_id]);
    }

    // Leadership roster & history
    const leaders = await db.all(`
      SELECT * FROM bible_study_group_leaders
      WHERE group_id = $1
      ORDER BY started_at DESC, id DESC
    `, [groupId]);

    res.json({
      group,
      created_transition: createdTransition ? { ...createdTransition, source_groups: sourceGroups } : null,
      merged_into_group: mergedIntoGroup,
      leaders
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific group
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const group = await db.get(`
      SELECT g.*,
             min.name as ministry_name, min.color as ministry_color,
             mg.name as merged_into_group_name,
             u_arch.name as archived_by_name
      FROM bible_study_groups g
      LEFT JOIN ministries min ON g.ministry_id = min.id
      LEFT JOIN bible_study_groups mg ON g.merged_into_group_id = mg.id
      LEFT JOIN users u_arch ON g.archived_by = u_arch.id
      WHERE g.id = $1
    `, [req.params.id]);

    if (!group) {
      return res.status(404).json({ error: "Small group not found" });
    }

    const [members, dbTopics, createdTransition, leaders] = await Promise.all([
      db.all(`
        SELECT bsm.*, m.first_name, m.last_name, m.contact_email, m.contact_phone
        FROM bible_study_members bsm
        LEFT JOIN members m ON bsm.member_id = m.id
        WHERE bsm.group_id = $1
        ORDER BY COALESCE(LOWER(m.first_name), LOWER(bsm.member_name)) ASC, LOWER(m.last_name) ASC
      `, [group.id]),
      db.all<{ title: string; total_chapters: number }>("SELECT title, total_chapters FROM bible_study_topics").catch(() => []),
      db.get(`
        SELECT t.*, u.name as created_by_name
        FROM bible_study_group_transitions t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.new_group_id = $1
        ORDER BY t.id DESC LIMIT 1
      `, [group.id]).catch(() => null),
      db.all(`
        SELECT * FROM bible_study_group_leaders
        WHERE group_id = $1
        ORDER BY started_at DESC, id DESC
      `, [group.id]).catch(() => [])
    ]);

    let sourceGroups: any[] = [];
    if (createdTransition) {
      sourceGroups = await db.all(`
        SELECT sg.id, sg.name, sg.leader_name, sg.leader_contact, sg.category, sg.status,
               (SELECT COUNT(*) FROM bible_study_members WHERE group_id = sg.id) as member_count
        FROM bible_study_group_transition_sources ts
        JOIN bible_study_groups sg ON ts.source_group_id = sg.id
        WHERE ts.transition_id = $1
        ORDER BY sg.name ASC
      `, [createdTransition.id]).catch(() => []);
    }

    let mergedIntoGroup = null;
    if (group.merged_into_group_id) {
      mergedIntoGroup = await db.get(`
        SELECT id, name, leader_name, assistant_leader_name, status, meeting_day, meeting_time, location
        FROM bible_study_groups
        WHERE id = $1
      `, [group.merged_into_group_id]).catch(() => null);
    }

    const totalChapters = group.completed_total_chapters || resolveTotalChapters(group.completed_book_title_snapshot || group.curriculum || "", dbTopics);

    res.json({
      ...group,
      curriculum_total_chapters: totalChapters,
      members: members.map(m => ({
        ...m,
        display_name: m.first_name ? `${m.first_name} ${m.last_name}` : m.member_name
      })),
      created_transition: createdTransition ? { ...createdTransition, source_groups: sourceGroups } : null,
      merged_into_group: mergedIntoGroup,
      leaders
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create group (Admin / Coordinator)
router.post("/", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      description,
      curriculum,
      ministry_id,
      leader_name,
      leader_contact,
      assistant_leader_name,
      assistant_leader_contact,
      assistant_leader_id,
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

    const existing = await db.get("SELECT id FROM bible_study_groups WHERE LOWER(name) = LOWER($1) AND COALESCE(status, 'active') = 'active'", [name.trim()]);
    if (existing) {
      return res.status(400).json({ error: "An active Bible study group with this name already exists" });
    }

    const result = await db.run(`
      INSERT INTO bible_study_groups (
        name, description, curriculum, ministry_id, leader_name, leader_contact,
        assistant_leader_name, assistant_leader_contact, assistant_leader_id,
        meeting_day, meeting_time, location, category, max_capacity,
        current_chapter, progress_stage, progress_notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'active')
      RETURNING id
    `, [
      name.trim(),
      description || null,
      curriculum || null,
      ministry_id ? Number(ministry_id) : null,
      leader_name.trim(),
      leader_contact || null,
      assistant_leader_name ? assistant_leader_name.trim() : null,
      assistant_leader_contact || null,
      assistant_leader_id ? Number(assistant_leader_id) : null,
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

    // Record primary leader in bible_study_group_leaders
    try {
      await db.run(`
        INSERT INTO bible_study_group_leaders (group_id, leader_name, leader_contact, role, started_at, status)
        VALUES ($1, $2, $3, 'primary', CURRENT_DATE, 'active')
      `, [newId, leader_name.trim(), leader_contact || null]);

      if (assistant_leader_name && assistant_leader_name.trim()) {
        await db.run(`
          INSERT INTO bible_study_group_leaders (group_id, leader_name, leader_contact, role, started_at, status)
          VALUES ($1, $2, $3, 'assistant', CURRENT_DATE, 'active')
        `, [newId, assistant_leader_name.trim(), assistant_leader_contact || null]);
      }
    } catch { }

    // Enroll initial selected members if provided
    if (Array.isArray(member_ids) && member_ids.length > 0) {
      for (const mId of member_ids) {
        const member = await db.get("SELECT first_name, last_name FROM members WHERE id = $1", [mId]);
        const mName = member ? `${member.first_name} ${member.last_name}` : "Member";
        await db.run(`
          INSERT INTO bible_study_members (group_id, member_id, member_name, status)
          VALUES ($1, $2, $3, 'active')
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
router.put("/:id", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator", "Leader"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const {
      name,
      description,
      curriculum,
      ministry_id,
      leader_name,
      leader_contact,
      assistant_leader_name,
      assistant_leader_contact,
      assistant_leader_id,
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
      reschedule_reason,
      status
    } = req.body;

    const current = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Small group not found" });

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "Group name cannot be empty" });
      const duplicate = await db.get("SELECT id FROM bible_study_groups WHERE LOWER(name) = LOWER($1) AND id != $2 AND COALESCE(status, 'active') = 'active'", [name.trim(), id]);
      if (duplicate) return res.status(400).json({ error: "Another active Bible study group already has this name" });
    }

    await db.run(`
      UPDATE bible_study_groups
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          curriculum = COALESCE($3, curriculum),
          ministry_id = COALESCE($4, ministry_id),
          leader_name = COALESCE($5, leader_name),
          leader_contact = COALESCE($6, leader_contact),
          assistant_leader_name = COALESCE($7, assistant_leader_name),
          assistant_leader_contact = COALESCE($8, assistant_leader_contact),
          assistant_leader_id = COALESCE($9, assistant_leader_id),
          meeting_day = COALESCE($10, meeting_day),
          meeting_time = COALESCE($11, meeting_time),
          location = COALESCE($12, location),
          category = COALESCE($13, category),
          max_capacity = COALESCE($14, max_capacity),
          current_chapter = COALESCE($15, current_chapter),
          progress_stage = COALESCE($16, progress_stage),
          progress_notes = COALESCE($17, progress_notes),
          is_rescheduled = COALESCE($18, is_rescheduled),
          rescheduled_date = COALESCE($19, rescheduled_date),
          rescheduled_time = COALESCE($20, rescheduled_time),
          reschedule_reason = COALESCE($21, reschedule_reason),
          status = COALESCE($22, status)
      WHERE id = $23
    `, [
      name !== undefined ? name.trim() : null,
      description,
      curriculum,
      ministry_id !== undefined ? (ministry_id ? Number(ministry_id) : null) : null,
      leader_name !== undefined ? leader_name.trim() : null,
      leader_contact,
      assistant_leader_name !== undefined ? (assistant_leader_name ? assistant_leader_name.trim() : null) : null,
      assistant_leader_contact,
      assistant_leader_id !== undefined ? (assistant_leader_id ? Number(assistant_leader_id) : null) : null,
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
      status,
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

// Mark Bible Study Group as Completed with Snapshot
router.post("/:id/complete", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator", "Leader"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const {
      completed_chapter,
      completed_total_chapters,
      completed_book_id,
      completed_book_title_snapshot,
      notes
    } = req.body;

    const group = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
    if (!group) return res.status(404).json({ error: "Small group not found" });

    if (group.status === "merged") {
      return res.status(400).json({ error: "Merged source groups cannot be marked as completed." });
    }

    const dbTopics = await db.all<{ id: number; title: string; total_chapters: number }>("SELECT id, title, total_chapters FROM bible_study_topics").catch(() => []);
    const titleSnapshot = completed_book_title_snapshot?.trim() || group.curriculum || "General Scripture Study";
    const matchedTopic = dbTopics.find(t => t.title.toLowerCase().trim() === titleSnapshot.toLowerCase().trim());
    const resolvedBookId = completed_book_id ? Number(completed_book_id) : (matchedTopic ? matchedTopic.id : null);
    const totalChapters = completed_total_chapters ? Number(completed_total_chapters) : (matchedTopic ? matchedTopic.total_chapters : resolveTotalChapters(titleSnapshot, dbTopics) || 12);
    const finishedChapter = completed_chapter?.trim() || group.current_chapter || `Chapter ${totalChapters}`;

    await db.run(`
      UPDATE bible_study_groups
      SET status = 'completed',
          progress_stage = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          completed_book_id = $1,
          completed_book_title_snapshot = $2,
          completed_chapter = $3,
          completed_total_chapters = $4,
          progress_notes = COALESCE($5, progress_notes)
      WHERE id = $6
    `, [
      resolvedBookId,
      titleSnapshot,
      finishedChapter,
      totalChapters,
      notes !== undefined ? (notes ? notes.trim() : null) : group.progress_notes,
      id
    ]);

    const auditText = `Marked Bible study group "${group.name}" as completed. Finished at: ${finishedChapter} of ${totalChapters} (${titleSnapshot}).`;
    await logAuditAction(req.user?.id || null, "GROUP_COMPLETED", "bible_study_groups", id, auditText);
    emitRealtimeEvent("groups:changed", { action: "complete", id });

    res.json({
      message: `✓ Small group "${group.name}" successfully marked as completed!`,
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_book_title_snapshot: titleSnapshot,
      completed_chapter: finishedChapter,
      completed_total_chapters: totalChapters
    });
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

    const newStage = progress_stage || current.progress_stage || 'in_progress';
    const isNowCompleted = newStage === 'completed';

    const dbTopics = await db.all<{ id: number; title: string; total_chapters: number }>("SELECT id, title, total_chapters FROM bible_study_topics").catch(() => []);
    const titleSnapshot = current.completed_book_title_snapshot || current.curriculum || "General Scripture Study";
    const matchedTopic = dbTopics.find(t => t.title.toLowerCase().trim() === titleSnapshot.toLowerCase().trim());
    const totalChapters = current.completed_total_chapters || (matchedTopic ? matchedTopic.total_chapters : resolveTotalChapters(titleSnapshot, dbTopics) || 12);
    const finishedChapter = current_chapter ? current_chapter.trim() : (current.current_chapter || `Chapter ${totalChapters}`);

    if (isNowCompleted && current.status === 'active') {
      await db.run(`
        UPDATE bible_study_groups
        SET current_chapter = $1,
            progress_stage = $2,
            progress_notes = $3,
            status = 'completed',
            completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
            completed_book_title_snapshot = COALESCE(completed_book_title_snapshot, $4),
            completed_chapter = COALESCE(completed_chapter, $1),
            completed_total_chapters = COALESCE(completed_total_chapters, $5)
        WHERE id = $6
      `, [
        finishedChapter,
        newStage,
        progress_notes !== undefined ? progress_notes : current.progress_notes,
        titleSnapshot,
        totalChapters,
        id
      ]);
    } else {
      await db.run(`
        UPDATE bible_study_groups
        SET current_chapter = COALESCE($1, current_chapter),
            progress_stage = COALESCE($2, progress_stage),
            progress_notes = $3
        WHERE id = $4
      `, [
        current_chapter ? current_chapter.trim() : current.current_chapter,
        newStage,
        progress_notes !== undefined ? progress_notes : current.progress_notes,
        id
      ]);
    }

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
router.patch("/:id/reschedule", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator", "Leader"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { is_rescheduled, rescheduled_date, rescheduled_time, reschedule_reason, location } = req.body;

    const current = await db.get<GroupNotificationRow>("SELECT id, name, ministry_id, leader_name, leader_contact, curriculum, meeting_day, meeting_time FROM bible_study_groups WHERE id = $1", [id]);
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

    if (Boolean(is_rescheduled)) {
      void sendRescheduleNotification(
        current,
        rescheduled_date || null,
        rescheduled_time || null,
        reschedule_reason || null
      );
    }

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

// Archive group (Soft Delete endpoint)
router.post("/:id/archive", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body;

    const group = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
    if (!group) return res.status(404).json({ error: "Small group not found" });

    if (group.status === "merged") {
      return res.status(400).json({ error: "Merged source groups cannot be archived directly." });
    }

    const archiveReason = reason && typeof reason === "string" && reason.trim() ? reason.trim() : "Group discontinued";

    await db.run(`
      UPDATE bible_study_groups
      SET status = 'archived',
          archived_at = CURRENT_TIMESTAMP,
          archived_by = $1,
          archive_reason = $2
      WHERE id = $3
    `, [req.user?.id || null, archiveReason, id]);

    await logAuditAction(
      req.user?.id || null,
      "GROUP_ARCHIVED",
      "bible_study_groups",
      id,
      `Archived Bible study group: ${group.name}. Reason: ${archiveReason}`
    );

    emitRealtimeEvent("groups:changed", { action: "archive", id });
    res.json({ message: `✓ Small group "${group.name}" moved to Archived Groups.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Soft Delete / Archive via DELETE route (Guarantees zero hard data loss)
router.delete("/:id", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const reason = (req.body?.reason || req.query?.reason || "Group archived") as string;

    const group = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
    if (!group) return res.status(404).json({ error: "Small group not found" });

    if (group.status === "merged") {
      return res.status(400).json({ error: "Merged source groups cannot be deleted or archived directly." });
    }

    await db.run(`
      UPDATE bible_study_groups
      SET status = 'archived',
          archived_at = CURRENT_TIMESTAMP,
          archived_by = $1,
          archive_reason = $2
      WHERE id = $3
    `, [req.user?.id || null, reason, id]);

    await logAuditAction(
      req.user?.id || null,
      "GROUP_ARCHIVED",
      "bible_study_groups",
      id,
      `Archived Bible study group: ${group.name}. Reason: ${reason}`
    );

    emitRealtimeEvent("groups:changed", { action: "archive", id });
    res.json({ message: `✓ Small group "${group.name}" archived successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Restore archived group back to active
router.post("/:id/restore", authMiddleware, requireRoles("Admin", "Pastor", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const group = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
    if (!group) return res.status(404).json({ error: "Small group not found" });

    if (group.status === "merged") {
      return res.status(400).json({ error: "Merged source groups cannot be restored directly." });
    }

    // Check name collision with currently active groups
    const conflict = await db.get(
      "SELECT id, name FROM bible_study_groups WHERE LOWER(name) = LOWER($1) AND id != $2 AND COALESCE(status, 'active') = 'active'",
      [group.name.trim(), id]
    );
    if (conflict) {
      return res.status(400).json({
        error: `Cannot restore group: an active Bible study group named "${group.name}" already exists. Please rename the active group or rename this group first.`
      });
    }

    await db.run(`
      UPDATE bible_study_groups
      SET status = 'active',
          archived_at = NULL,
          archived_by = NULL,
          archive_reason = NULL
      WHERE id = $1
    `, [id]);

    await logAuditAction(
      req.user?.id || null,
      "GROUP_RESTORED",
      "bible_study_groups",
      id,
      `Restored Bible study group to active: ${group.name}`
    );

    emitRealtimeEvent("groups:changed", { action: "restore", id });
    res.json({ message: `✓ Small group "${group.name}" restored to Active Groups successfully!` });
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
      const consecutiveAbsences = countConsecutiveAbsences(history.map(h => ({
        member_id: memId,
        session_date: h.session_date,
        status: h.status
      })));

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
      special_reason,
      update_group_progress
    } = req.body;

    if (!session_date) {
      return res.status(400).json({ error: "session_date is required (YYYY-MM-DD)" });
    }

    const group = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [groupId]);
    if (!group) {
      return res.status(404).json({ error: "Small group not found" });
    }

    if (update_group_progress !== undefined && typeof update_group_progress !== "boolean") {
      return res.status(400).json({ error: "update_group_progress must be a boolean" });
    }
    if (update_group_progress) {
      if (typeof topic_title !== "string" || !topic_title.trim() || topic_title.length > 300 ||
          typeof chapter !== "string" || !chapter.trim() || chapter.length > 120) {
        return res.status(400).json({ error: "A book / study topic and chapter are required to update group progress." });
      }
      const role = req.user?.role_name;
      if (!["Admin", "IT Admin", "Pastor", "Coordinator", "Leader"].includes(role || "")) {
        return res.status(403).json({ error: "Only group facilitators can update study progress." });
      }
      if (role === "Leader") {
        const assigned = await db.get(`SELECT g.id FROM bible_study_groups g WHERE g.id = $2 AND ${MY_GROUP_LEADER_SCOPE}`, [req.user!.id, groupId]);
        if (!assigned) return res.status(403).json({ error: "This group is not assigned to you." });
      }
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

    // 3. Upsert session record and attendance records inside a transaction
    await db.transaction(async (client) => {
      // Serialize lesson updates with attendance so a failed save cannot advance progress.
      const locked = await client.query("SELECT status FROM bible_study_groups WHERE id = $1 FOR UPDATE", [groupId]);
      if (update_group_progress) {
        if (locked.rows[0]?.status !== "active") {
          throw Object.assign(new Error("Only active groups can update their study progress."), { status: 409 });
        }
        const newer = await client.query("SELECT 1 FROM bible_study_sessions WHERE group_id = $1 AND session_date > $2 LIMIT 1", [groupId, session_date]);
        if (newer.rows.length) {
          throw Object.assign(new Error("A newer session exists. Save this historical lesson without updating current group progress."), { status: 409 });
        }
      }
      await client.query(`
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

      const groupMembersRes = await client.query<{ member_id: number }>(
        "SELECT member_id FROM bible_study_members WHERE group_id = $1",
        [groupId]
      );
      const groupMembers = groupMembersRes.rows;

      if (update_group_progress) {
        await client.query(`UPDATE bible_study_groups
          SET curriculum = $1, current_chapter = $2,
              progress_stage = CASE WHEN curriculum IS DISTINCT FROM $1 THEN 'in_progress' ELSE progress_stage END
          WHERE id = $3`, [topic_title.trim(), chapter.trim(), groupId]);
      }

      if (Array.isArray(records) && records.length > 0) {
        for (const rec of records) {
          await client.query(`
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
          await client.query(`
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
    });

    await logAuditAction(
      req.user?.id || null,
      "CREATE",
      "bible_study_attendance",
      groupId,
      `Recorded Bible Study attendance session for ${group.name} on ${session_date}${update_group_progress ? `; updated study progress to ${topic_title.trim()} / ${chapter.trim()}` : ""}`
    );

    emitRealtimeEvent("attendance:changed", { action: "save_session", group_id: groupId, session_date });
    emitRealtimeEvent("groups:changed", { action: "attendance_update", id: groupId });

    void sendAbsenceSessionNotification(groupId, session_date);

    res.json({ message: `✓ Attendance session for ${session_date} logged successfully!` });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
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

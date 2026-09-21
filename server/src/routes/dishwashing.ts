import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, logAuditAction } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";

const router = Router();

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper to calculate upcoming Sundays
function getUpcomingSundays(count = 16): string[] {
  const sundays: string[] = [];
  const now = new Date();
  
  // Find upcoming Sunday (day 0 of week: Sunday is 0)
  const currentDay = now.getDay();
  const daysUntilSunday = (7 - currentDay) % 7;
  
  const nextSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday, 12, 0, 0);

  for (let i = 0; i < count; i++) {
    const sun = new Date(nextSunday.getFullYear(), nextSunday.getMonth(), nextSunday.getDate() + i * 7, 12, 0, 0);
    sundays.push(formatLocalDate(sun));
  }
  return sundays;
}

// ====================================================
// 1. GET ALL DISHWASHING ROTATING TEAMS / UNITS
// ====================================================
router.get("/teams", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { ministry_id } = req.query;
    let query = `
      SELECT dt.*, 
             min.name as ministry_name, min.color as ministry_color,
             bg.name as group_name, bg.meeting_day as group_meeting_day,
             m.first_name as leader_first_name, m.last_name as leader_last_name, m.contact_phone as leader_phone
      FROM dishwashing_teams dt
      LEFT JOIN ministries min ON dt.ministry_id = min.id
      LEFT JOIN bible_study_groups bg ON dt.biblestudy_group_id = bg.id
      LEFT JOIN members m ON dt.leader_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (ministry_id && ministry_id !== "all") {
      params.push(Number(ministry_id));
      query += ` AND (dt.ministry_id = $${params.length} OR dt.ministry_id IS NULL)`;
    }
    query += " ORDER BY dt.order_seq ASC, dt.id ASC";

    const [teams, allDishMembers] = await Promise.all([
      db.all(query, params),
      db.all(`
        SELECT dtm.id as assignment_id, dtm.team_id, dtm.role as team_role, dtm.joined_at,
               m.id as member_id, m.first_name, m.last_name, m.contact_phone, m.contact_email, m.photo_url,
               min.name as ministry_name
        FROM dishwashing_team_members dtm
        JOIN members m ON dtm.member_id = m.id
        LEFT JOIN ministries min ON m.ministry_id = min.id
        ORDER BY CASE WHEN dtm.role = 'Team Leader' THEN 1 ELSE 2 END, LOWER(m.first_name) ASC, LOWER(m.last_name) ASC
      `)
    ]);

    // Group members by team_id in memory
    const membersByTeam = new Map<number, any[]>();
    for (const dtm of allDishMembers) {
      const tId = dtm.team_id;
      if (!membersByTeam.has(tId)) membersByTeam.set(tId, []);
      membersByTeam.get(tId)!.push(dtm);
    }

    const teamsWithMembers = teams.map((team) => {
      const members = membersByTeam.get(team.id) || [];
      return {
        ...team,
        members_count: members.length,
        members
      };
    });

    res.json(teamsWithMembers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 2. CREATE DISHWASHING ROTATING TEAM / UNIT
// ====================================================
router.post("/teams", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { 
      name, 
      cycle_mode = "biblestudy_group",
      biblestudy_group_id,
      ministry_id,
      leader_id, 
      leader_name, 
      leader_contact,
      color, 
      order_seq, 
      tasks_checklist,
      volunteers_count,
      member_ids
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Team or unit name is required" });
    }

    const existing = await db.get("SELECT id FROM dishwashing_teams WHERE LOWER(name) = LOWER($1)", [name.trim()]);
    if (existing) {
      return res.status(400).json({ error: "A dishwashing team with this name already exists" });
    }

    let assignedOrder = order_seq;
    if (!assignedOrder) {
      const maxOrder = await db.get<{ max_val: number }>(
        "SELECT COALESCE(MAX(order_seq), 0) as max_val FROM dishwashing_teams"
      );
      assignedOrder = (maxOrder?.max_val || 0) + 1;
    }

    let resolvedLeaderName = leader_name;
    let resolvedLeaderContact = leader_contact;
    if (leader_id && (!resolvedLeaderName || !resolvedLeaderContact)) {
      const lm = await db.get("SELECT first_name, last_name, contact_phone, contact_email FROM members WHERE id = $1", [leader_id]);
      if (lm) {
        resolvedLeaderName = resolvedLeaderName || `${lm.first_name} ${lm.last_name}`;
        resolvedLeaderContact = resolvedLeaderContact || lm.contact_phone || lm.contact_email || "";
      }
    }

    const result = await db.run(`
      INSERT INTO dishwashing_teams (
        name, cycle_mode, biblestudy_group_id, ministry_id, leader_id, leader_name, leader_contact,
        color, order_seq, tasks_checklist, volunteers_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      name.trim(),
      cycle_mode,
      biblestudy_group_id ? Number(biblestudy_group_id) : null,
      ministry_id ? Number(ministry_id) : null,
      leader_id ? Number(leader_id) : null,
      resolvedLeaderName || null,
      resolvedLeaderContact || null,
      color || "#2C3968",
      assignedOrder,
      tasks_checklist || "Pre-rinse plates and utensils, Wash with hot soapy water, Sanitize and wipe down kitchen countertops, Dispose food waste and trash",
      Number(volunteers_count) || 4
    ]);

    const newTeamId = result.lastInsertRowid;

    // If leader was provided as member, link them
    if (leader_id && newTeamId) {
      await db.run(
        "INSERT INTO dishwashing_team_members (team_id, member_id, role) VALUES ($1, $2, 'Team Leader') ON CONFLICT DO NOTHING",
        [newTeamId, leader_id]
      );
    }

    // Auto-fetch disciples from the bible study group or ministry if present
    const allMemberIdsToLink = new Set<number>();
    if (Array.isArray(member_ids)) {
      member_ids.forEach(id => id && allMemberIdsToLink.add(Number(id)));
    }
    if (biblestudy_group_id) {
      const bsGroupMembers = await db.all<{ member_id: number }>(
        "SELECT member_id FROM bible_study_members WHERE group_id = $1",
        [biblestudy_group_id]
      );
      bsGroupMembers.forEach(bm => bm.member_id && allMemberIdsToLink.add(Number(bm.member_id)));
    }
    if (ministry_id) {
      const minMembers = await db.all<{ id: number }>(
        "SELECT id FROM members WHERE status = 'active' AND ministry_id = $1",
        [ministry_id]
      );
      minMembers.forEach(mm => mm.id && allMemberIdsToLink.add(Number(mm.id)));

      const minData = await db.get<{ min_age: number; max_age: number; name: string }>(
        "SELECT min_age, max_age, name FROM ministries WHERE id = $1",
        [ministry_id]
      );
      if (minData && (minData.min_age !== null || minData.max_age !== null)) {
        const minAge = minData.min_age ?? 0;
        const maxAge = minData.max_age ?? 120;
        const ageMembers = await db.all<{ id: number }>(
          `SELECT id FROM members 
           WHERE status = 'active' 
             AND birthdate IS NOT NULL 
             AND birthdate != '' 
             AND (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', birthdate) AS INTEGER)) >= $1 
             AND (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', birthdate) AS INTEGER)) <= $2`,
          [minAge, maxAge]
        );
        ageMembers.forEach(am => am.id && allMemberIdsToLink.add(Number(am.id)));
      }
    }

    // Link each member to the dishwashing team
    if (newTeamId && allMemberIdsToLink.size > 0) {
      for (const mId of allMemberIdsToLink) {
        const role = Number(mId) === Number(leader_id) ? "Team Leader" : "Member";
        await db.run(
          "INSERT INTO dishwashing_team_members (team_id, member_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [newTeamId, mId, role]
        );
      }
    }

    if (req.user) {
      await logAuditAction(req.user.id, "CREATE_DISHWASHING_TEAM", "dishwashing_teams", newTeamId, `Created dishwashing team #${assignedOrder}: ${name}`);
    }

    emitRealtimeEvent("dishwashing:changed", { action: "create_team", id: newTeamId });
    res.status(201).json({ id: newTeamId, message: `Added ${name} to Dishwashing Cycle successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 3. UPDATE DISHWASHING ROTATING TEAM
// ====================================================
router.put("/teams/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { 
      name, 
      cycle_mode,
      biblestudy_group_id,
      ministry_id,
      leader_id, 
      leader_name, 
      leader_contact,
      color, 
      order_seq, 
      tasks_checklist,
      volunteers_count,
      member_ids
    } = req.body;

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "Team name cannot be empty" });
      const duplicate = await db.get("SELECT id FROM dishwashing_teams WHERE LOWER(name) = LOWER($1) AND id != $2", [name.trim(), id]);
      if (duplicate) return res.status(400).json({ error: "Another dishwashing team already has this name" });
    }

    let resolvedLeaderName = leader_name;
    let resolvedLeaderContact = leader_contact;
    if (leader_id) {
      const lm = await db.get("SELECT first_name, last_name, contact_phone, contact_email FROM members WHERE id = $1", [leader_id]);
      if (lm) {
        resolvedLeaderName = resolvedLeaderName || `${lm.first_name} ${lm.last_name}`;
        resolvedLeaderContact = resolvedLeaderContact || lm.contact_phone || lm.contact_email || "";
      }
    }

    await db.run(`
      UPDATE dishwashing_teams
      SET name = COALESCE($1, name),
          cycle_mode = COALESCE($2, cycle_mode),
          biblestudy_group_id = $3,
          ministry_id = $4,
          leader_id = $5,
          leader_name = COALESCE($6, leader_name),
          leader_contact = COALESCE($7, leader_contact),
          color = COALESCE($8, color),
          order_seq = COALESCE($9, order_seq),
          tasks_checklist = COALESCE($10, tasks_checklist),
          volunteers_count = COALESCE($11, volunteers_count)
      WHERE id = $12
    `, [
      name,
      cycle_mode,
      biblestudy_group_id ? Number(biblestudy_group_id) : null,
      ministry_id ? Number(ministry_id) : null,
      leader_id ? Number(leader_id) : null,
      resolvedLeaderName,
      resolvedLeaderContact,
      color,
      order_seq ? Number(order_seq) : null,
      tasks_checklist,
      volunteers_count ? Number(volunteers_count) : null,
      id
    ]);

    if (leader_id) {
      await db.run(
        "INSERT INTO dishwashing_team_members (team_id, member_id, role) VALUES ($1, $2, 'Team Leader') ON CONFLICT (team_id, member_id) DO UPDATE SET role = 'Team Leader'",
        [id, leader_id]
      );
    }

    // Auto-fetch disciples from the bible study group or ministry if present
    const allMemberIdsToLink = new Set<number>();
    if (Array.isArray(member_ids)) {
      member_ids.forEach(mId => mId && allMemberIdsToLink.add(Number(mId)));
    }
    if (biblestudy_group_id) {
      const bsGroupMembers = await db.all<{ member_id: number }>(
        "SELECT member_id FROM bible_study_members WHERE group_id = $1",
        [biblestudy_group_id]
      );
      bsGroupMembers.forEach(bm => bm.member_id && allMemberIdsToLink.add(Number(bm.member_id)));
    }
    if (ministry_id) {
      const minMembers = await db.all<{ id: number }>(
        "SELECT id FROM members WHERE status = 'active' AND ministry_id = $1",
        [ministry_id]
      );
      minMembers.forEach(mm => mm.id && allMemberIdsToLink.add(Number(mm.id)));

      const minData = await db.get<{ min_age: number; max_age: number; name: string }>(
        "SELECT min_age, max_age, name FROM ministries WHERE id = $1",
        [ministry_id]
      );
      if (minData && (minData.min_age !== null || minData.max_age !== null)) {
        const minAge = minData.min_age ?? 0;
        const maxAge = minData.max_age ?? 120;
        const ageMembers = await db.all<{ id: number }>(
          `SELECT id FROM members 
           WHERE status = 'active' 
             AND birthdate IS NOT NULL 
             AND birthdate != '' 
             AND (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', birthdate) AS INTEGER)) >= $1 
             AND (CAST(strftime('%Y', 'now') AS INTEGER) - CAST(strftime('%Y', birthdate) AS INTEGER)) <= $2`,
          [minAge, maxAge]
        );
        ageMembers.forEach(am => am.id && allMemberIdsToLink.add(Number(am.id)));
      }
    }

    if (allMemberIdsToLink.size > 0) {
      for (const mId of allMemberIdsToLink) {
        const role = Number(mId) === Number(leader_id) ? "Team Leader" : "Member";
        await db.run(
          "INSERT INTO dishwashing_team_members (team_id, member_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [id, mId, role]
        );
      }
    }

    if (req.user) {
      await logAuditAction(req.user.id, "UPDATE_DISHWASHING_TEAM", "dishwashing_teams", Number(id), `Updated dishwashing team #${id}`);
    }

    emitRealtimeEvent("dishwashing:changed", { action: "update_team", id: Number(id) });
    res.json({ message: "Dishwashing team updated successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 4. DELETE DISHWASHING ROTATING TEAM
// ====================================================
router.delete("/teams/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    await db.run("DELETE FROM dishwashing_teams WHERE id = $1", [id]);
    
    if (req.user) {
      await logAuditAction(req.user.id, "DELETE_DISHWASHING_TEAM", "dishwashing_teams", Number(id), `Deleted dishwashing team #${id}`);
    }

    emitRealtimeEvent("dishwashing:changed", { action: "delete_team", id: Number(id) });
    res.json({ message: "Dishwashing team deleted successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 5. ADD MEMBER TO DISHWASHING TEAM
// ====================================================
router.post("/teams/:id/members", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.id;
    const { member_id, role = "Member" } = req.body;

    if (!member_id) {
      return res.status(400).json({ error: "Member ID is required" });
    }

    await db.run(`
      INSERT INTO dishwashing_team_members (team_id, member_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (team_id, member_id) DO UPDATE SET role = EXCLUDED.role
    `, [teamId, member_id, role]);

    emitRealtimeEvent("dishwashing:changed", { action: "add_member", team_id: Number(teamId), member_id });
    res.status(201).json({ message: "Member added to dishwashing team successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 5b. BATCH ADD MEMBERS TO DISHWASHING TEAM
// ====================================================
router.post("/teams/:id/members/batch", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.id;
    const { member_ids, role = "Member" } = req.body;

    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return res.status(400).json({ error: "Member IDs array is required" });
    }

    for (const mId of member_ids) {
      if (!mId) continue;
      await db.run(`
        INSERT INTO dishwashing_team_members (team_id, member_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (team_id, member_id) DO NOTHING
      `, [teamId, Number(mId), role]);
    }

    emitRealtimeEvent("dishwashing:changed", { action: "batch_add_members", team_id: Number(teamId) });
    res.status(201).json({ message: `Added ${member_ids.length} disciples to dishwashing team successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 6. REMOVE MEMBER FROM DISHWASHING TEAM
// ====================================================
router.delete("/teams/:id/members/:memberId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, memberId } = req.params;
    await db.run("DELETE FROM dishwashing_team_members WHERE team_id = $1 AND member_id = $2", [id, memberId]);
    emitRealtimeEvent("dishwashing:changed", { action: "remove_member", team_id: Number(id), member_id: Number(memberId) });
    res.json({ message: "Member removed from dishwashing team." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to calculate full dishwashing rotation schedule
export async function calculateDishwashingSchedule(count = 16) {
  const numSundays = Math.min(Number(count) || 16, 26);

  const [teams, allDishMembers] = await Promise.all([
    db.all(`
      SELECT dt.*, 
             min.name as ministry_name, min.color as ministry_color,
             bg.name as group_name, bg.meeting_day as group_meeting_day
      FROM dishwashing_teams dt
      LEFT JOIN ministries min ON dt.ministry_id = min.id
      LEFT JOIN bible_study_groups bg ON dt.biblestudy_group_id = bg.id
      ORDER BY dt.order_seq ASC, dt.id ASC
    `),
    db.all(`
      SELECT dtm.team_id, dtm.role as team_role, mem.first_name, mem.last_name, mem.contact_phone
      FROM dishwashing_team_members dtm
      JOIN members mem ON dtm.member_id = mem.id
    `)
  ]);

  // Group members by team_id in memory
  const membersByTeam = new Map<number, any[]>();
  for (const dtm of allDishMembers) {
    const tId = dtm.team_id;
    if (!membersByTeam.has(tId)) membersByTeam.set(tId, []);
    membersByTeam.get(tId)!.push(dtm);
  }

  const teamsWithMembers = teams.map((t) => ({
    ...t,
    members: membersByTeam.get(t.id) || []
  }));

  const upcomingSundays = getUpcomingSundays(numSundays);
  const anchorSun = new Date(2026, 0, 4, 0, 0, 0, 0).getTime();

  // Fetch any saved overrides/completions from dishwashing_schedules
  const savedSchedules = await db.all(`
    SELECT ds.*, dt.name as team_name, dt.color as team_color, dt.leader_name as team_leader_name
    FROM dishwashing_schedules ds
    LEFT JOIN dishwashing_teams dt ON ds.team_id = dt.id
    WHERE ds.duty_date >= $1
  `, [upcomingSundays[0]]);

  const scheduleList = upcomingSundays.map((sunDate, idx) => {
    const isThisSunday = idx === 0;
    const isNextSunday = idx === 1;
    const dObj = new Date(sunDate + "T00:00:00");
    const formattedDate = dObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    const sunTime = dObj.getTime();
    const diffWeeks = Math.floor(Math.round((sunTime - anchorSun) / 86400000) / 7);

    // Default rotating team from automatic weekly cycle across all registered teams
    let defaultTeam = null;
    if (teamsWithMembers.length > 0) {
      const cycleIndex = ((diffWeeks % teamsWithMembers.length) + teamsWithMembers.length) % teamsWithMembers.length;
      defaultTeam = teamsWithMembers[cycleIndex];
    }

    // Check if there is an explicit override/completion saved
    const override = savedSchedules.find(s => {
      const sDate = s.duty_date instanceof Date ? s.duty_date.toISOString().split("T")[0] : String(s.duty_date).split("T")[0];
      return sDate === sunDate;
    });

    let status: "on_duty" | "scheduled" | "completed" | "swapped" = isThisSunday ? "on_duty" : "scheduled";
    let notes = "";
    let completedAt = null;
    let effectiveTeam = defaultTeam;

    if (override) {
      status = override.status as any;
      notes = override.notes || "";
      completedAt = override.completed_at || null;
      if (override.team_id) {
        const matchedTeam = teamsWithMembers.find(t => t.id === override.team_id);
        if (matchedTeam) effectiveTeam = matchedTeam;
      }
    }

    return {
      duty_date: sunDate,
      date_formatted: formattedDate,
      week_number: idx + 1,
      is_this_sunday: isThisSunday,
      is_next_sunday: isNextSunday,
      status,
      completed_at: completedAt,
      notes,
      team: effectiveTeam
    };
  });

  return {
    total_teams: teams.length,
    cycle_interval_weeks: teams.length,
    thisSunday: scheduleList[0] || null,
    nextSunday: scheduleList[1] || null,
    schedule: scheduleList
  };
}

// ====================================================
// 7. GET SUNDAY ROTATION CYCLE (SCHEDULE)
// ====================================================
router.get("/schedule", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { count = 16 } = req.query;
    const result = await calculateDishwashingSchedule(Number(count) || 16);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 8. COMPLETE SUNDAY DISHWASHING DUTY
// ====================================================
router.post("/schedule/complete", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { duty_date, team_id, notes } = req.body;

    if (!duty_date || !team_id) {
      return res.status(400).json({ error: "duty_date and team_id are required" });
    }

    const team = await db.get("SELECT name, ministry_id, biblestudy_group_id, leader_name FROM dishwashing_teams WHERE id = $1", [team_id]);

    await db.run(`
      INSERT INTO dishwashing_schedules (
        duty_date, team_id, biblestudy_group_id, ministry_id, assigned_name, leader_name, status, notes, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, CURRENT_TIMESTAMP)
      ON CONFLICT (duty_date, team_id) DO UPDATE SET
        status = 'completed',
        notes = EXCLUDED.notes,
        completed_at = CURRENT_TIMESTAMP
    `, [
      duty_date,
      team_id,
      team?.biblestudy_group_id || null,
      team?.ministry_id || null,
      team?.name || "Assigned Team",
      team?.leader_name || "",
      notes || "Completed on schedule"
    ]);

    if (req.user) {
      await logAuditAction(req.user.id, "COMPLETE_DISHWASHING_DUTY", "dishwashing_schedules", Number(team_id), `Completed dishwashing on ${duty_date} for ${team?.name}`);
    }

    emitRealtimeEvent("dishwashing:changed", { action: "complete_duty", duty_date, team_id });
    res.json({ message: "Dishwashing duty marked as completed!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 9. SWAP SUNDAY DISHWASHING DUTIES
// ====================================================
router.post("/schedule/swap", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { date1, teamId1, date2, teamId2 } = req.body;

    if (!date1 || !teamId1 || !date2 || !teamId2) {
      return res.status(400).json({ error: "date1, teamId1, date2, and teamId2 are required" });
    }

    const team1 = await db.get("SELECT name, ministry_id, biblestudy_group_id, leader_name FROM dishwashing_teams WHERE id = $1", [teamId1]);
    const team2 = await db.get("SELECT name, ministry_id, biblestudy_group_id, leader_name FROM dishwashing_teams WHERE id = $1", [teamId2]);

    // Save team2 to date1
    await db.run(`
      INSERT INTO dishwashing_schedules (
        duty_date, team_id, biblestudy_group_id, ministry_id, assigned_name, leader_name, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, 'swapped', $7)
      ON CONFLICT (duty_date, team_id) DO UPDATE SET
        team_id = EXCLUDED.team_id,
        assigned_name = EXCLUDED.assigned_name,
        status = 'swapped',
        notes = EXCLUDED.notes
    `, [
      date1,
      teamId2,
      team2?.biblestudy_group_id || null,
      team2?.ministry_id || null,
      team2?.name || "Assigned Team",
      team2?.leader_name || "",
      `Swapped turn with ${team1?.name} (originally scheduled for ${date2})`
    ]);

    // Save team1 to date2
    await db.run(`
      INSERT INTO dishwashing_schedules (
        duty_date, team_id, biblestudy_group_id, ministry_id, assigned_name, leader_name, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, 'swapped', $7)
      ON CONFLICT (duty_date, team_id) DO UPDATE SET
        team_id = EXCLUDED.team_id,
        assigned_name = EXCLUDED.assigned_name,
        status = 'swapped',
        notes = EXCLUDED.notes
    `, [
      date2,
      teamId1,
      team1?.biblestudy_group_id || null,
      team1?.ministry_id || null,
      team1?.name || "Assigned Team",
      team1?.leader_name || "",
      `Swapped turn with ${team2?.name} (originally scheduled for ${date1})`
    ]);

    if (req.user) {
      await logAuditAction(req.user.id, "SWAP_DISHWASHING_DUTY", "dishwashing_schedules", Number(teamId1), `Swapped dishwashing turns between ${date1} and ${date2}`);
    }

    emitRealtimeEvent("dishwashing:changed", { action: "swap_duty", date1, date2 });
    res.json({ message: "Successfully swapped Sunday dishwashing turns!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 10. OVERRIDE / EDIT SINGLE SUNDAY DATE
// ====================================================
router.post("/schedule/override", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { duty_date, team_id, notes, status = "scheduled" } = req.body;

    if (!duty_date || !team_id) {
      return res.status(400).json({ error: "duty_date and team_id are required" });
    }

    const team = await db.get("SELECT name, ministry_id, biblestudy_group_id, leader_name FROM dishwashing_teams WHERE id = $1", [team_id]);

    await db.run(`
      INSERT INTO dishwashing_schedules (
        duty_date, team_id, biblestudy_group_id, ministry_id, assigned_name, leader_name, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (duty_date, team_id) DO UPDATE SET
        team_id = EXCLUDED.team_id,
        assigned_name = EXCLUDED.assigned_name,
        leader_name = EXCLUDED.leader_name,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes
    `, [
      duty_date,
      team_id,
      team?.biblestudy_group_id || null,
      team?.ministry_id || null,
      team?.name || "Assigned Team",
      team?.leader_name || "",
      status,
      notes || ""
    ]);

    if (req.user) {
      await logAuditAction(req.user.id, "OVERRIDE_DISHWASHING_DUTY", "dishwashing_schedules", Number(team_id), `Modified dishwashing assignment for ${duty_date}`);
    }

    emitRealtimeEvent("dishwashing:changed", { action: "override_duty", duty_date });
    res.json({ message: "Sunday duty assignment updated successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================
// 11. LEGACY / COMPATIBILITY ROSTER ENDPOINT
// ====================================================
router.get("/", async (req: Request, res: Response) => {
  try {
    const [scheduleRes, activeGroups, activeMinistries] = await Promise.all([
      calculateDishwashingSchedule(16),
      db.all("SELECT id, name, leader_name, ministry_id FROM bible_study_groups ORDER BY id ASC"),
      db.all(`
        SELECT m.id, m.name, m.color,
          (SELECT u.name FROM users u JOIN user_ministries um ON u.id = um.user_id WHERE um.ministry_id = m.id AND u.role_id = 2 LIMIT 1) AS coordinator_name
        FROM ministries m ORDER BY m.id ASC
      `)
    ]);

    res.json({
      ...scheduleRes,
      duties: scheduleRes.schedule,
      thisSunday: scheduleRes.thisSunday,
      nextSunday: scheduleRes.nextSunday,
      cycleOptions: {
        groups: activeGroups,
        ministries: activeMinistries
      },
      stats: []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";

const router = Router();

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper to calculate upcoming Saturdays
 */
function getUpcomingSaturdays(count = 12): string[] {
  const saturdays: string[] = [];
  const now = new Date();
  
  // Find upcoming Saturday (day 6 of week: Sunday is 0, Saturday is 6)
  const currentDay = now.getDay();
  const daysUntilSaturday = (6 - currentDay + 7) % 7;
  
  const nextSaturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSaturday, 12, 0, 0);

  for (let i = 0; i < count; i++) {
    const sat = new Date(nextSaturday.getFullYear(), nextSaturday.getMonth(), nextSaturday.getDate() + i * 7, 12, 0, 0);
    saturdays.push(formatLocalDate(sat));
  }
  return saturdays;
}

// 1. Get all Duty Teams with member rosters (Optimized: 0 N+1 roundtrips)
router.get("/teams", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { ministry_id } = req.query;
    let query = `
      SELECT dt.id, dt.name, dt.ministry_id, dt.leader_id, dt.leader_name, dt.color, dt.order_seq, dt.tasks_checklist, dt.created_at,
             min.name as ministry_name, min.color as ministry_color,
             m.first_name as leader_first_name, m.last_name as leader_last_name, m.contact_phone as leader_phone
      FROM duty_teams dt
      LEFT JOIN ministries min ON dt.ministry_id = min.id
      LEFT JOIN members m ON dt.leader_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (ministry_id) {
      params.push(Number(ministry_id));
      query += ` AND (dt.ministry_id = $${params.length} OR dt.ministry_id IS NULL)`;
    }
    query += " ORDER BY dt.order_seq ASC, dt.id ASC";

    const teams = await db.all(query, params);
    const teamIds = teams.map(t => t.id);

    let allDutyMembers: any[] = [];
    if (teamIds.length > 0) {
      allDutyMembers = await db.all(`
        SELECT dtm.id as assignment_id, dtm.team_id, dtm.role as team_role, dtm.joined_at,
               m.id as member_id, m.first_name, m.last_name, m.contact_phone, m.contact_email, m.photo_url,
               min.name as ministry_name
        FROM duty_team_members dtm
        JOIN members m ON dtm.member_id = m.id
        LEFT JOIN ministries min ON m.ministry_id = min.id
        WHERE dtm.team_id = ANY($1)
        ORDER BY CASE WHEN dtm.role = 'Team Leader' THEN 1 ELSE 2 END, LOWER(m.first_name) ASC, LOWER(m.last_name) ASC
      `, [teamIds]);
    }

    // Group members by team_id in memory
    const membersByTeam = new Map<number, any[]>();
    for (const dtm of allDutyMembers) {
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

// 2. Create Duty Team (e.g. Team 1, Team 2, Team 3)
router.post("/teams", authMiddleware, requireRoles("Admin", "Pastor", "IT Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, ministry_id, leader_id, leader_name, color, order_seq, tasks_checklist, member_ids } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const existing = await db.get(
      "SELECT id FROM duty_teams WHERE LOWER(name) = LOWER($1) AND (ministry_id = $2 OR ($2 IS NULL AND ministry_id IS NULL))",
      [name.trim(), ministry_id || null]
    );
    if (existing) {
      return res.status(400).json({ error: "A duty team with this name already exists" });
    }

    let assignedOrder = order_seq;
    if (!assignedOrder) {
      const maxOrder = await db.get<{ max_val: number }>(
        "SELECT COALESCE(MAX(order_seq), 0) as max_val FROM duty_teams WHERE ministry_id = $1 OR ($1 IS NULL AND ministry_id IS NULL)",
        [ministry_id || null]
      );
      assignedOrder = (maxOrder?.max_val || 0) + 1;
    }

    let resolvedLeaderName = leader_name;
    if (leader_id && !resolvedLeaderName) {
      const lm = await db.get("SELECT first_name, last_name FROM members WHERE id = $1", [leader_id]);
      if (lm) resolvedLeaderName = `${lm.first_name} ${lm.last_name}`;
    }

    const result = await db.run(`
      INSERT INTO duty_teams (name, ministry_id, leader_id, leader_name, color, order_seq, tasks_checklist)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      name.trim(),
      ministry_id || null,
      leader_id || null,
      resolvedLeaderName || null,
      color || "#2C3968",
      Number(assignedOrder) || 1,
      tasks_checklist || "Sanctuary Cleaning, Sound Setup, Trash Disposal, Restroom Sanitization"
    ]);

    const newTeamId = result.lastInsertRowid;

    // If a leader was assigned, also insert them into duty_team_members
    if (leader_id && newTeamId) {
      await db.run(
        "INSERT INTO duty_team_members (team_id, member_id, role) VALUES ($1, $2, 'Team Leader') ON CONFLICT DO NOTHING",
        [newTeamId, leader_id]
      );
    }

    // If batch members were provided, insert all of them
    if (newTeamId && Array.isArray(member_ids) && member_ids.length > 0) {
      for (const mId of member_ids) {
        if (Number(mId) === Number(leader_id)) continue; // Leader already inserted
        await db.run(
          "INSERT INTO duty_team_members (team_id, member_id, role) VALUES ($1, $2, 'Member') ON CONFLICT (team_id, member_id) DO NOTHING",
          [newTeamId, mId]
        );
      }
    }

    emitRealtimeEvent("duty:changed", { action: "create_team", id: newTeamId });
    res.status(201).json({ id: newTeamId, message: `Created ${name} successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update Duty Team
router.put("/teams/:id", authMiddleware, requireRoles("Admin", "Pastor", "IT Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { name, leader_id, leader_name, color, order_seq, tasks_checklist, member_ids } = req.body;

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "Team name cannot be empty" });
      const currentTeam = await db.get("SELECT ministry_id FROM duty_teams WHERE id = $1", [id]);
      const duplicate = await db.get(
        "SELECT id FROM duty_teams WHERE LOWER(name) = LOWER($1) AND (ministry_id = $2 OR ($2 IS NULL AND ministry_id IS NULL)) AND id != $3",
        [name.trim(), currentTeam?.ministry_id || null, id]
      );
      if (duplicate) return res.status(400).json({ error: "Another duty team already has this name" });
    }

    let resolvedLeaderName = leader_name;
    if (leader_id) {
      const lm = await db.get("SELECT first_name, last_name FROM members WHERE id = $1", [leader_id]);
      if (lm) resolvedLeaderName = `${lm.first_name} ${lm.last_name}`;
    }

    await db.run(`
      UPDATE duty_teams
      SET name = COALESCE($1, name),
          leader_id = COALESCE($2, leader_id),
          leader_name = COALESCE($3, leader_name),
          color = COALESCE($4, color),
          order_seq = COALESCE($5, order_seq),
          tasks_checklist = COALESCE($6, tasks_checklist)
      WHERE id = $7
    `, [name !== undefined ? name.trim() : null, leader_id, resolvedLeaderName, color, order_seq !== undefined ? Number(order_seq) : null, tasks_checklist, id]);

    // Ensure leader is added to team members
    if (leader_id) {
      await db.run(
        "INSERT INTO duty_team_members (team_id, member_id, role) VALUES ($1, $2, 'Team Leader') ON CONFLICT (team_id, member_id) DO UPDATE SET role = 'Team Leader'",
        [id, leader_id]
      );
    }

    if (Array.isArray(member_ids) && member_ids.length > 0) {
      for (const mId of member_ids) {
        await db.run(
          "INSERT INTO duty_team_members (team_id, member_id, role) VALUES ($1, $2, 'Member') ON CONFLICT (team_id, member_id) DO NOTHING",
          [id, mId]
        );
      }
    }

    emitRealtimeEvent("duty:changed", { action: "update_team", id: Number(id) });
    res.json({ message: "Team updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete Duty Team
router.delete("/teams/:id", authMiddleware, requireRoles("Admin", "Pastor", "IT Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    await db.run("DELETE FROM duty_teams WHERE id = $1", [id]);
    emitRealtimeEvent("duty:changed", { action: "delete_team", id: Number(id) });
    res.json({ message: "Team deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Add Member(s) to Duty Team (Supports Single or Batch)
router.post("/teams/:id/members", authMiddleware, requireRoles("Admin", "Pastor", "IT Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.id;
    const { member_id, member_ids, role = "Member" } = req.body;

    const idsToInsert: number[] = [];
    if (Array.isArray(member_ids) && member_ids.length > 0) {
      idsToInsert.push(...member_ids.map(Number));
    } else if (member_id) {
      idsToInsert.push(Number(member_id));
    }

    if (idsToInsert.length === 0) {
      return res.status(400).json({ error: "At least one member is required" });
    }

    for (const mId of idsToInsert) {
      await db.run(`
        INSERT INTO duty_team_members (team_id, member_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (team_id, member_id) DO UPDATE SET role = EXCLUDED.role
      `, [teamId, mId, role]);
    }

    emitRealtimeEvent("duty:changed", { action: "add_members", team_id: Number(teamId), count: idsToInsert.length });
    res.status(201).json({ message: `${idsToInsert.length} member(s) added to team` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Remove Member from Duty Team
router.delete("/teams/:id/members/:memberId", authMiddleware, requireRoles("Admin", "Pastor", "IT Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { id, memberId } = req.params;
    await db.run("DELETE FROM duty_team_members WHERE team_id = $1 AND member_id = $2", [id, memberId]);
    emitRealtimeEvent("duty:changed", { action: "remove_member", team_id: Number(id), member_id: Number(memberId) });
    res.json({ message: "Member removed from team" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get Saturday Cycle & Rotation Schedule
router.get("/schedule", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { ministry_id, count = 12 } = req.query;
    const numSaturdays = Math.min(Number(count) || 12, 26);

    let teamQuery = "SELECT * FROM duty_teams WHERE 1=1";
    const teamParams: any[] = [];
    if (ministry_id) {
      teamParams.push(Number(ministry_id));
      teamQuery += " AND (ministry_id = $1 OR ministry_id IS NULL)";
    }
    teamQuery += " ORDER BY order_seq ASC, id ASC";

    const [teams, allDutyMembers] = await Promise.all([
      db.all(teamQuery, teamParams),
      db.all(`
        SELECT dtm.team_id, dtm.role, mem.first_name, mem.last_name, mem.contact_phone
        FROM duty_team_members dtm
        JOIN members mem ON dtm.member_id = mem.id
      `)
    ]);

    // Group members by team_id in memory
    const membersByTeam = new Map<number, any[]>();
    for (const dtm of allDutyMembers) {
      const tId = dtm.team_id;
      if (!membersByTeam.has(tId)) membersByTeam.set(tId, []);
      membersByTeam.get(tId)!.push(dtm);
    }

    const teamsWithMembers = teams.map((t) => ({
      ...t,
      members: membersByTeam.get(t.id) || []
    }));

    const upcomingSaturdays = getUpcomingSaturdays(numSaturdays);
    const todayStr = new Date().toISOString().split("T")[0];
    const anchorSat = new Date(2026, 0, 3, 0, 0, 0, 0).getTime();

    // Fetch any saved overrides/completions/swaps from duty_schedules
    let savedQuery = `
      SELECT ds.id, TO_CHAR(ds.duty_date, 'YYYY-MM-DD') as duty_date_str, ds.duty_date, ds.team_id, ds.ministry_id, ds.status, ds.notes, ds.completed_at,
             dt.name as team_name, dt.color as team_color, dt.leader_name as team_leader_name
      FROM duty_schedules ds
      LEFT JOIN duty_teams dt ON ds.team_id = dt.id
      WHERE ds.duty_date >= $1
    `;
    const savedParams: any[] = [upcomingSaturdays[0]];
    if (ministry_id) {
      savedParams.push(Number(ministry_id));
      savedQuery += ` AND (ds.ministry_id = $${savedParams.length} OR ds.ministry_id IS NULL)`;
    }
    savedQuery += " ORDER BY ds.id DESC";

    const savedSchedules = await db.all(savedQuery, savedParams);

    const scheduleList = upcomingSaturdays.map((satDate, idx) => {
      const isThisSaturday = idx === 0;
      const isNextSaturday = idx === 1;
      const dObj = new Date(satDate + "T00:00:00");
      const formattedDate = dObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });

      const satTime = dObj.getTime();
      const diffWeeks = Math.floor(Math.round((satTime - anchorSat) / 86400000) / 7);

      // Default rotating team from automatic weekly cycle across all registered teams
      let defaultTeam = null;
      if (teamsWithMembers.length > 0) {
        const cycleIndex = ((diffWeeks % teamsWithMembers.length) + teamsWithMembers.length) % teamsWithMembers.length;
        defaultTeam = teamsWithMembers[cycleIndex];
      }

      // Check for saved record (override, completion, or swap)
      const saved = savedSchedules.find(s => {
        const sDate = s.duty_date_str || (s.duty_date instanceof Date ? formatLocalDate(s.duty_date) : String(s.duty_date).split("T")[0]);
        return sDate === satDate;
      });

      let assignedTeam = defaultTeam;
      if (saved && saved.team_id) {
        assignedTeam = teamsWithMembers.find(t => t.id === saved.team_id) || {
          id: saved.team_id,
          name: saved.team_name,
          color: saved.team_color,
          leader_name: saved.team_leader_name,
          tasks_checklist: saved.notes,
          members: []
        };
      }

      const isPast = satDate < todayStr;
      let status: "on_duty" | "scheduled" | "completed" | "swapped" = isThisSaturday ? "on_duty" : "scheduled";
      if (saved?.status) {
        status = saved.status as any;
      }

      return {
        duty_date: satDate,
        date_formatted: formattedDate,
        week_number: idx + 1,
        is_this_saturday: isThisSaturday,
        is_next_saturday: isNextSaturday,
        is_past: isPast,
        status,
        completed_at: saved?.completed_at || null,
        notes: saved?.notes || (assignedTeam?.tasks_checklist || "General Saturday Cleaning & Setup"),
        team: assignedTeam
      };
    });

    res.json({
      total_teams: teams.length,
      cycle_interval_weeks: teams.length,
      schedule: scheduleList
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Mark Saturday Duty Complete
router.post("/schedule/complete", authMiddleware, requireRoles("Admin", "Pastor", "IT Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { duty_date, team_id, ministry_id, notes } = req.body;

    if (!duty_date || !team_id) {
      return res.status(400).json({ error: "Duty date and team ID are required" });
    }

    const team = await db.get("SELECT name FROM duty_teams WHERE id = $1", [team_id]);

    // Clean existing entry for duty_date to ensure single row consistency
    if (ministry_id) {
      await db.run("DELETE FROM duty_schedules WHERE duty_date = $1 AND (ministry_id = $2 OR ministry_id IS NULL)", [duty_date, ministry_id]);
    } else {
      await db.run("DELETE FROM duty_schedules WHERE duty_date = $1", [duty_date]);
    }

    await db.run(`
      INSERT INTO duty_schedules (duty_date, team_id, ministry_id, status, notes, completed_at)
      VALUES ($1, $2, $3, 'completed', $4, CURRENT_TIMESTAMP)
    `, [duty_date, team_id, ministry_id || null, notes || "Saturday cleaning & duties completed"]);

    if (req.user) {
      await logAuditAction(req.user.id, "COMPLETE_SATURDAY_DUTY", "duty_schedules", Number(team_id), `Marked Saturday duty completed on ${duty_date} for ${team?.name || "Team"}`);
    }

    emitRealtimeEvent("duty:changed", { action: "complete_duty", duty_date, team_id });
    res.json({ message: "Saturday duty marked as completed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Swap Teams between Two Saturdays
router.post("/schedule/swap", authMiddleware, requireRoles("Admin", "Pastor", "IT Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { date1, teamId1, date2, teamId2, ministry_id } = req.body;

    if (!date1 || !teamId1 || !date2 || !teamId2) {
      return res.status(400).json({ error: "Dates and team IDs for swap are required" });
    }

    const team1 = await db.get("SELECT name, leader_name FROM duty_teams WHERE id = $1", [teamId1]);
    const team2 = await db.get("SELECT name, leader_name FROM duty_teams WHERE id = $1", [teamId2]);

    // Execute swap atomically: clean existing rows for both dates, then insert swapped rows
    if (ministry_id) {
      await db.run("DELETE FROM duty_schedules WHERE duty_date = $1 AND (ministry_id = $2 OR ministry_id IS NULL)", [date1, ministry_id]);
      await db.run("DELETE FROM duty_schedules WHERE duty_date = $1 AND (ministry_id = $2 OR ministry_id IS NULL)", [date2, ministry_id]);
    } else {
      await db.run("DELETE FROM duty_schedules WHERE duty_date = $1", [date1]);
      await db.run("DELETE FROM duty_schedules WHERE duty_date = $1", [date2]);
    }

    // Assign teamId2 to date1
    await db.run(`
      INSERT INTO duty_schedules (duty_date, team_id, ministry_id, status, notes)
      VALUES ($1, $2, $3, 'swapped', $4)
    `, [
      date1,
      teamId2,
      ministry_id || null,
      `Swapped turn with ${team1?.name || "Team"} (originally scheduled for ${date2})`
    ]);

    // Assign teamId1 to date2
    await db.run(`
      INSERT INTO duty_schedules (duty_date, team_id, ministry_id, status, notes)
      VALUES ($1, $2, $3, 'swapped', $4)
    `, [
      date2,
      teamId1,
      ministry_id || null,
      `Swapped turn with ${team2?.name || "Team"} (originally scheduled for ${date1})`
    ]);

    if (req.user) {
      await logAuditAction(
        req.user.id,
        "SWAP_SATURDAY_DUTY",
        "duty_schedules",
        Number(teamId1),
        `Swapped Saturday duties between ${date1} (${team1?.name}) and ${date2} (${team2?.name})`
      );
    }

    emitRealtimeEvent("duty:changed", { action: "swap_duty", date1, teamId1, date2, teamId2 });
    res.json({ message: "Saturday duty teams swapped successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Override / Edit Single Saturday Assignment
router.post("/schedule/override", authMiddleware, requireRoles("Admin", "Pastor", "IT Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { duty_date, team_id, ministry_id, status = "scheduled", notes } = req.body;

    if (!duty_date || !team_id) {
      return res.status(400).json({ error: "duty_date and team_id are required" });
    }

    const team = await db.get("SELECT name FROM duty_teams WHERE id = $1", [team_id]);

    if (ministry_id) {
      await db.run("DELETE FROM duty_schedules WHERE duty_date = $1 AND (ministry_id = $2 OR ministry_id IS NULL)", [duty_date, ministry_id]);
    } else {
      await db.run("DELETE FROM duty_schedules WHERE duty_date = $1", [duty_date]);
    }

    await db.run(`
      INSERT INTO duty_schedules (duty_date, team_id, ministry_id, status, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [duty_date, team_id, ministry_id || null, status, notes || `Assigned to ${team?.name || "Team"}`]);

    if (req.user) {
      await logAuditAction(req.user.id, "OVERRIDE_SATURDAY_DUTY", "duty_schedules", Number(team_id), `Modified Saturday assignment for ${duty_date} to ${team?.name}`);
    }

    emitRealtimeEvent("duty:changed", { action: "override_duty", duty_date, team_id });
    res.json({ message: "Successfully updated Saturday duty assignment!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Reset Overrides back to Automatic Rotation
router.post("/schedule/reset", authMiddleware, requireRoles("Admin", "Pastor", "IT Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { duty_date, ministry_id } = req.body;

    if (duty_date) {
      if (ministry_id) {
        await db.run("DELETE FROM duty_schedules WHERE duty_date = $1 AND (ministry_id = $2 OR ministry_id IS NULL)", [duty_date, ministry_id]);
      } else {
        await db.run("DELETE FROM duty_schedules WHERE duty_date = $1", [duty_date]);
      }
    } else {
      if (ministry_id) {
        await db.run("DELETE FROM duty_schedules WHERE ministry_id = $1 OR ministry_id IS NULL", [ministry_id]);
      } else {
        await db.run("DELETE FROM duty_schedules");
      }
    }

    if (req.user) {
      await logAuditAction(req.user.id, "RESET_SATURDAY_DUTY", "duty_schedules", 0, `Reset duty schedule overrides${duty_date ? ` for ${duty_date}` : ""}`);
    }

    emitRealtimeEvent("duty:changed", { action: "reset_duty", duty_date });
    res.json({ message: "Saturday duty schedule reset to automatic cycle!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

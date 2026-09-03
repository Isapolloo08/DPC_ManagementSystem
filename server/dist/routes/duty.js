"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
/**
 * Helper to calculate upcoming Saturdays
 */
function getUpcomingSaturdays(count = 12) {
    const saturdays = [];
    const now = new Date();
    // Find upcoming Saturday (day 6 of week: Sunday is 0, Saturday is 6)
    const currentDay = now.getDay();
    const daysUntilSaturday = (6 - currentDay + 7) % 7;
    const nextSaturday = new Date(now);
    nextSaturday.setDate(now.getDate() + daysUntilSaturday);
    nextSaturday.setHours(0, 0, 0, 0);
    for (let i = 0; i < count; i++) {
        const sat = new Date(nextSaturday);
        sat.setDate(nextSaturday.getDate() + i * 7);
        saturdays.push(sat.toISOString().split("T")[0]);
    }
    return saturdays;
}
// 1. Get all Duty Teams with member rosters
router.get("/teams", auth_1.authMiddleware, async (req, res) => {
    try {
        const { ministry_id } = req.query;
        let query = `
      SELECT dt.*, 
             min.name as ministry_name, min.color as ministry_color,
             m.first_name as leader_first_name, m.last_name as leader_last_name, m.contact_phone as leader_phone
      FROM duty_teams dt
      LEFT JOIN ministries min ON dt.ministry_id = min.id
      LEFT JOIN members m ON dt.leader_id = m.id
      WHERE 1=1
    `;
        const params = [];
        if (ministry_id) {
            params.push(Number(ministry_id));
            query += ` AND (dt.ministry_id = $${params.length} OR dt.ministry_id IS NULL)`;
        }
        query += " ORDER BY dt.order_seq ASC, dt.id ASC";
        const teams = await schema_1.db.all(query, params);
        // Fetch members for each team
        const teamsWithMembers = await Promise.all(teams.map(async (team) => {
            const teamMembers = await schema_1.db.all(`
        SELECT dtm.id as assignment_id, dtm.role as team_role, dtm.joined_at,
               m.id as member_id, m.first_name, m.last_name, m.contact_phone, m.contact_email, m.photo_url,
               min.name as ministry_name
        FROM duty_team_members dtm
        JOIN members m ON dtm.member_id = m.id
        LEFT JOIN ministries min ON m.ministry_id = min.id
        WHERE dtm.team_id = $1
        ORDER BY CASE WHEN dtm.role = 'Team Leader' THEN 1 ELSE 2 END, m.last_name ASC
      `, [team.id]);
            return {
                ...team,
                members_count: teamMembers.length,
                members: teamMembers
            };
        }));
        res.json(teamsWithMembers);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 2. Create Duty Team (e.g. Team 1, Team 2, Team 3)
router.post("/teams", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const { name, ministry_id, leader_id, leader_name, color, order_seq, tasks_checklist } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Team name is required" });
        }
        let assignedOrder = order_seq;
        if (!assignedOrder) {
            const maxOrder = await schema_1.db.get("SELECT COALESCE(MAX(order_seq), 0) as max_val FROM duty_teams WHERE ministry_id = $1 OR ($1 IS NULL AND ministry_id IS NULL)", [ministry_id || null]);
            assignedOrder = (maxOrder?.max_val || 0) + 1;
        }
        let resolvedLeaderName = leader_name;
        if (leader_id && !resolvedLeaderName) {
            const lm = await schema_1.db.get("SELECT first_name, last_name FROM members WHERE id = $1", [leader_id]);
            if (lm)
                resolvedLeaderName = `${lm.first_name} ${lm.last_name}`;
        }
        const result = await schema_1.db.run(`
      INSERT INTO duty_teams (name, ministry_id, leader_id, leader_name, color, order_seq, tasks_checklist)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
            name,
            ministry_id || null,
            leader_id || null,
            resolvedLeaderName || null,
            color || "#2C3968",
            assignedOrder,
            tasks_checklist || "Sanctuary Cleaning, Sound Setup, Trash Disposal, Restroom Sanitization"
        ]);
        const newTeamId = result.lastInsertRowid;
        // If a leader was assigned, also insert them into duty_team_members
        if (leader_id && newTeamId) {
            await schema_1.db.run("INSERT INTO duty_team_members (team_id, member_id, role) VALUES ($1, $2, 'Team Leader') ON CONFLICT DO NOTHING", [newTeamId, leader_id]);
        }
        res.status(201).json({ id: newTeamId, message: `Created ${name} successfully` });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 3. Update Duty Team
router.put("/teams/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const id = req.params.id;
        const { name, leader_id, leader_name, color, order_seq, tasks_checklist } = req.body;
        let resolvedLeaderName = leader_name;
        if (leader_id) {
            const lm = await schema_1.db.get("SELECT first_name, last_name FROM members WHERE id = $1", [leader_id]);
            if (lm)
                resolvedLeaderName = `${lm.first_name} ${lm.last_name}`;
        }
        await schema_1.db.run(`
      UPDATE duty_teams
      SET name = COALESCE($1, name),
          leader_id = COALESCE($2, leader_id),
          leader_name = COALESCE($3, leader_name),
          color = COALESCE($4, color),
          order_seq = COALESCE($5, order_seq),
          tasks_checklist = COALESCE($6, tasks_checklist)
      WHERE id = $7
    `, [name, leader_id, resolvedLeaderName, color, order_seq, tasks_checklist, id]);
        // Ensure leader is added to team members
        if (leader_id) {
            await schema_1.db.run("INSERT INTO duty_team_members (team_id, member_id, role) VALUES ($1, $2, 'Team Leader') ON CONFLICT (team_id, member_id) DO UPDATE SET role = 'Team Leader'", [id, leader_id]);
        }
        res.json({ message: "Team updated successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 4. Delete Duty Team
router.delete("/teams/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const id = req.params.id;
        await schema_1.db.run("DELETE FROM duty_teams WHERE id = $1", [id]);
        res.json({ message: "Team deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 5. Add Member to Duty Team
router.post("/teams/:id/members", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const teamId = req.params.id;
        const { member_id, role = "Member" } = req.body;
        if (!member_id) {
            return res.status(400).json({ error: "Member is required" });
        }
        await schema_1.db.run(`
      INSERT INTO duty_team_members (team_id, member_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (team_id, member_id) DO UPDATE SET role = EXCLUDED.role
    `, [teamId, member_id, role]);
        res.status(201).json({ message: "Member added to team" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 6. Remove Member from Duty Team
router.delete("/teams/:id/members/:memberId", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const { id, memberId } = req.params;
        await schema_1.db.run("DELETE FROM duty_team_members WHERE team_id = $1 AND member_id = $2", [id, memberId]);
        res.json({ message: "Member removed from team" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 7. Get Saturday Cycle & Rotation Schedule
router.get("/schedule", auth_1.authMiddleware, async (req, res) => {
    try {
        const { ministry_id, count = 12 } = req.query;
        const numSaturdays = Math.min(Number(count) || 12, 26);
        let teamQuery = "SELECT * FROM duty_teams WHERE 1=1";
        const teamParams = [];
        if (ministry_id) {
            teamParams.push(Number(ministry_id));
            teamQuery += " AND (ministry_id = $1 OR ministry_id IS NULL)";
        }
        teamQuery += " ORDER BY order_seq ASC, id ASC";
        const teams = await schema_1.db.all(teamQuery, teamParams);
        // Fetch team members for full context
        const teamsWithMembers = await Promise.all(teams.map(async (t) => {
            const m = await schema_1.db.all(`
        SELECT dtm.role, mem.first_name, mem.last_name, mem.contact_phone
        FROM duty_team_members dtm
        JOIN members mem ON dtm.member_id = mem.id
        WHERE dtm.team_id = $1
      `, [t.id]);
            return { ...t, members: m };
        }));
        const upcomingSaturdays = getUpcomingSaturdays(numSaturdays);
        const todayStr = new Date().toISOString().split("T")[0];
        // Fetch any saved overrides/completions from duty_schedules
        const savedSchedules = await schema_1.db.all(`
      SELECT ds.*, dt.name as team_name, dt.color as team_color, dt.leader_name as team_leader_name
      FROM duty_schedules ds
      JOIN duty_teams dt ON ds.team_id = dt.id
      WHERE ds.duty_date >= $1
    `, [upcomingSaturdays[0]]);
        const scheduleList = upcomingSaturdays.map((satDate, idx) => {
            const isThisSaturday = idx === 0;
            const dObj = new Date(satDate);
            const formattedDate = dObj.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric"
            });
            // Check for saved record
            const saved = savedSchedules.find(s => s.duty_date === satDate || s.duty_date?.toString().startsWith(satDate));
            let assignedTeam = null;
            if (saved) {
                assignedTeam = teamsWithMembers.find(t => t.id === saved.team_id) || {
                    id: saved.team_id,
                    name: saved.team_name,
                    color: saved.team_color,
                    leader_name: saved.team_leader_name,
                    tasks_checklist: saved.notes,
                    members: []
                };
            }
            else if (teamsWithMembers.length > 0) {
                // Automatically cycle every Saturday
                const cycleIndex = idx % teamsWithMembers.length;
                assignedTeam = teamsWithMembers[cycleIndex];
            }
            return {
                duty_date: satDate,
                date_formatted: formattedDate,
                week_number: idx + 1,
                is_this_saturday: isThisSaturday,
                is_past: satDate < todayStr,
                status: saved?.status || (isThisSaturday ? "on_duty" : "scheduled"),
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 8. Mark Saturday Duty Complete
router.post("/schedule/complete", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator", "Leader"), async (req, res) => {
    try {
        const { duty_date, team_id, ministry_id, notes } = req.body;
        if (!duty_date || !team_id) {
            return res.status(400).json({ error: "Duty date and team ID are required" });
        }
        await schema_1.db.run(`
      INSERT INTO duty_schedules (duty_date, team_id, ministry_id, status, notes, completed_at)
      VALUES ($1, $2, $3, 'completed', $4, CURRENT_TIMESTAMP)
      ON CONFLICT (duty_date, team_id) DO UPDATE
      SET status = 'completed',
          notes = COALESCE(EXCLUDED.notes, duty_schedules.notes),
          completed_at = CURRENT_TIMESTAMP
    `, [duty_date, team_id, ministry_id || null, notes || "Saturday cleaning & duties completed"]);
        res.json({ message: "Saturday duty marked as completed" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 9. Swap Teams between Two Saturdays
router.post("/schedule/swap", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const { date1, teamId1, date2, teamId2, ministry_id } = req.body;
        if (!date1 || !teamId1 || !date2 || !teamId2) {
            return res.status(400).json({ error: "Dates and team IDs for swap are required" });
        }
        // Assign teamId2 to date1
        await schema_1.db.run(`
      INSERT INTO duty_schedules (duty_date, team_id, ministry_id, status, notes)
      VALUES ($1, $2, $3, 'swapped', 'Date swapped with team')
      ON CONFLICT (duty_date, team_id) DO UPDATE SET team_id = $2, status = 'swapped'
    `, [date1, teamId2, ministry_id || null]);
        // Assign teamId1 to date2
        await schema_1.db.run(`
      INSERT INTO duty_schedules (duty_date, team_id, ministry_id, status, notes)
      VALUES ($1, $2, $3, 'swapped', 'Date swapped with team')
      ON CONFLICT (duty_date, team_id) DO UPDATE SET team_id = $2, status = 'swapped'
    `, [date2, teamId1, ministry_id || null]);
        res.json({ message: "Saturday duty teams swapped successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;

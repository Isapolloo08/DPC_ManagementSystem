"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Helper to format Date as YYYY-MM-DD
function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
/**
 * GET /api/dishwashing
 * List all dishwashing roster schedules with joined group and ministry info
 */
router.get("/", async (req, res) => {
    try {
        const { status, cycle_mode } = req.query;
        let query = `
      SELECT 
        d.*,
        m.name AS ministry_name,
        m.color AS ministry_color,
        bg.name AS group_name,
        bg.meeting_day AS group_meeting_day,
        bg.leader_name AS group_leader_name
      FROM dishwashing_roster d
      LEFT JOIN ministries m ON d.ministry_id = m.id
      LEFT JOIN bible_study_groups bg ON d.biblestudy_group_id = bg.id
      WHERE 1=1
    `;
        const params = [];
        if (status && typeof status === "string" && status !== "all") {
            params.push(status);
            query += ` AND d.status = $${params.length}`;
        }
        if (cycle_mode && typeof cycle_mode === "string" && cycle_mode !== "all") {
            params.push(cycle_mode);
            query += ` AND d.cycle_mode = $${params.length}`;
        }
        query += ` ORDER BY d.duty_date ASC`;
        const duties = await schema_1.db.all(query, params);
        // Identify this Sunday's duty and Next Sunday's duty
        const todayStr = "2026-08-28"; // App's current calendar baseline
        // Find upcoming or active duties
        const upcoming = duties.filter((d) => d.status === "scheduled" || d.duty_date >= todayStr);
        const thisSunday = upcoming[0] || duties[0] || null;
        const nextSunday = upcoming[1] || duties[1] || null;
        // Get active cycle groups / ministries for visual order mapping & autofills
        const activeGroups = await schema_1.db.all("SELECT id, name, leader_name, ministry_id FROM bible_study_groups ORDER BY id ASC");
        const activeMinistries = await schema_1.db.all(`
      SELECT 
        m.id, 
        m.name, 
        m.color,
        (
          SELECT u.name 
          FROM users u 
          JOIN user_ministries um ON u.id = um.user_id 
          WHERE um.ministry_id = m.id AND u.role_id = 2
          LIMIT 1
        ) AS coordinator_name
      FROM ministries m
      ORDER BY m.id ASC
    `);
        // Compute fairness count per group/ministry
        const statsQuery = `
      SELECT 
        assigned_name,
        COUNT(*) as total_assigned,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as total_completed
      FROM dishwashing_roster
      GROUP BY assigned_name
      ORDER BY total_assigned DESC
    `;
        const stats = await schema_1.db.all(statsQuery);
        res.json({
            duties,
            thisSunday,
            nextSunday,
            cycleOptions: {
                groups: activeGroups,
                ministries: activeMinistries
            },
            stats
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/dishwashing/generate-cycle
 * 1-Click round-robin auto-generation across Bible Study Groups or Ministries
 * Supports 1 team or 2 partner teams teamed up per Sunday
 */
router.post("/generate-cycle", auth_1.authMiddleware, async (req, res) => {
    try {
        const { cycle_mode = "biblestudy_group", start_date = "2026-08-30", weeks_count = 8, replace_existing = true, teams_per_turn = 1 // 1 or 2 teams teamed up
         } = req.body;
        const weeks = Math.max(1, Math.min(Number(weeks_count) || 8, 52));
        const isJoint = Number(teams_per_turn) === 2;
        let items = [];
        if (cycle_mode === "biblestudy_group") {
            items = await schema_1.db.all("SELECT id, name, leader_name, ministry_id FROM bible_study_groups ORDER BY id ASC");
        }
        else {
            const mins = await schema_1.db.all(`
        SELECT 
          m.id, 
          m.name, 
          (
            SELECT u.name 
            FROM users u 
            JOIN user_ministries um ON u.id = um.user_id 
            WHERE um.ministry_id = m.id AND u.role_id = 2
            LIMIT 1
          ) AS coordinator_name
        FROM ministries m
        ORDER BY m.id ASC
      `);
            items = mins.map(m => ({
                id: m.id,
                name: `${m.name} Ministry`,
                leader_name: m.coordinator_name || "Ministry Coordinator",
                ministry_id: m.id
            }));
        }
        if (items.length === 0) {
            return res.status(400).json({ error: "No active groups or ministries found to generate cycle." });
        }
        if (replace_existing) {
            // Clear future scheduled duties starting from start_date
            await schema_1.db.run("DELETE FROM dishwashing_roster WHERE duty_date >= $1 AND status = 'scheduled'", [start_date]);
        }
        const startDateObj = new Date(start_date);
        const createdList = [];
        for (let i = 0; i < weeks; i++) {
            const currentDate = new Date(startDateObj);
            currentDate.setDate(startDateObj.getDate() + (i * 7));
            const dutyDateStr = formatDate(currentDate);
            let team1 = items[i % items.length];
            let team2 = null;
            let cycleIndex = (i % items.length) + 1;
            if (isJoint && items.length > 1) {
                team1 = items[(i * 2) % items.length];
                team2 = items[(i * 2 + 1) % items.length];
            }
            const newRow = await schema_1.db.run(`
        INSERT INTO dishwashing_roster (
          duty_date,
          event_name,
          cycle_mode,
          cycle_order_index,
          biblestudy_group_id,
          ministry_id,
          assigned_name,
          leader_name,
          partner_assigned_name,
          partner_leader_name,
          partner_biblestudy_group_id,
          partner_ministry_id,
          is_joint_duty,
          volunteers_count,
          status,
          notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `, [
                dutyDateStr,
                "Sunday Fellowship Lunch",
                cycle_mode,
                cycleIndex,
                cycle_mode === "biblestudy_group" ? team1.id : null,
                team1.ministry_id || (cycle_mode === "ministry" ? team1.id : null),
                team1.name,
                team1.leader_name || (cycle_mode === "biblestudy_group" ? "Group Leader" : "Ministry Coordinator"),
                team2 ? team2.name : null,
                team2 ? (team2.leader_name || (cycle_mode === "biblestudy_group" ? "Group Leader" : "Ministry Coordinator")) : null,
                team2 && cycle_mode === "biblestudy_group" ? team2.id : null,
                team2 && cycle_mode === "ministry" ? team2.id : (team2?.ministry_id || null),
                team2 ? true : false,
                isJoint ? 6 : 4,
                "scheduled",
                isJoint ? `Joint Duty: ${team1.name} & ${team2?.name}` : `Cycle Turn ${cycleIndex} of ${items.length}`
            ]);
            createdList.push({
                id: newRow.lastInsertRowid,
                duty_date: dutyDateStr,
                assigned_name: team2 ? `${team1.name} & ${team2.name}` : team1.name
            });
        }
        if (req.user) {
            await (0, auth_1.logAuditAction)(req.user.id, "GENERATE_DISHWASHING_CYCLE", "dishwashing_roster", 0, `Generated ${weeks} weeks dishwashing cycle mode: ${cycle_mode} (${isJoint ? 'Joint 2 Teams' : 'Single Team'}) starting ${start_date}`);
        }
        res.json({
            message: `Successfully generated ${weeks} weeks of dishwashing duty cycle!`,
            totalCreated: createdList.length,
            created: createdList
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/dishwashing
 * Add a single custom dishwashing assignment with optional 2nd teamed-up partner
 */
router.post("/", auth_1.authMiddleware, async (req, res) => {
    try {
        const { duty_date, cycle_mode = "biblestudy_group", biblestudy_group_id, ministry_id, assigned_name, leader_name, partner_assigned_name, partner_leader_name, partner_biblestudy_group_id, partner_ministry_id, is_joint_duty = false, volunteers_count = 4, notes } = req.body;
        if (!duty_date || !assigned_name) {
            return res.status(400).json({ error: "duty_date and assigned_name are required" });
        }
        const result = await schema_1.db.run(`
      INSERT INTO dishwashing_roster (
        duty_date, event_name, cycle_mode, biblestudy_group_id, ministry_id,
        assigned_name, leader_name,
        partner_assigned_name, partner_leader_name, partner_biblestudy_group_id, partner_ministry_id, is_joint_duty,
        volunteers_count, status, notes
      ) VALUES ($1, 'Sunday Fellowship Lunch', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'scheduled', $13)
      RETURNING id
    `, [
            duty_date,
            cycle_mode,
            biblestudy_group_id || null,
            ministry_id || null,
            assigned_name,
            leader_name || "",
            partner_assigned_name || null,
            partner_leader_name || null,
            partner_biblestudy_group_id || null,
            partner_ministry_id || null,
            Boolean(is_joint_duty),
            Number(volunteers_count) || (is_joint_duty ? 6 : 4),
            notes || ""
        ]);
        if (req.user) {
            await (0, auth_1.logAuditAction)(req.user.id, "CREATE_DISHWASHING_DUTY", "dishwashing_roster", result.lastInsertRowid, `Created duty for ${assigned_name} ${partner_assigned_name ? `& ${partner_assigned_name}` : ''} on ${duty_date}`);
        }
        res.status(201).json({ id: result.lastInsertRowid, message: "Dishwashing duty scheduled successfully." });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * PUT /api/dishwashing/:id
 * Update status or details of a dishwashing schedule
 */
router.put("/:id", auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, volunteers_count, assigned_name, leader_name, duty_date, cycle_mode, biblestudy_group_id, ministry_id, partner_assigned_name, partner_leader_name, partner_biblestudy_group_id, partner_ministry_id, is_joint_duty } = req.body;
        const existing = await schema_1.db.get("SELECT * FROM dishwashing_roster WHERE id = $1", [id]);
        if (!existing) {
            return res.status(404).json({ error: "Dishwashing duty not found." });
        }
        await schema_1.db.run(`
      UPDATE dishwashing_roster
      SET 
        status = COALESCE($1, status),
        notes = COALESCE($2, notes),
        volunteers_count = COALESCE($3, volunteers_count),
        assigned_name = COALESCE($4, assigned_name),
        leader_name = COALESCE($5, leader_name),
        duty_date = COALESCE($6, duty_date),
        cycle_mode = COALESCE($7, cycle_mode),
        biblestudy_group_id = COALESCE($8, biblestudy_group_id),
        ministry_id = COALESCE($9, ministry_id),
        partner_assigned_name = $10,
        partner_leader_name = $11,
        partner_biblestudy_group_id = $12,
        partner_ministry_id = $13,
        is_joint_duty = $14
      WHERE id = $15
    `, [
            status,
            notes,
            volunteers_count ? Number(volunteers_count) : null,
            assigned_name,
            leader_name,
            duty_date,
            cycle_mode,
            biblestudy_group_id ? Number(biblestudy_group_id) : null,
            ministry_id ? Number(ministry_id) : null,
            partner_assigned_name !== undefined ? partner_assigned_name : existing.partner_assigned_name,
            partner_leader_name !== undefined ? partner_leader_name : existing.partner_leader_name,
            partner_biblestudy_group_id !== undefined ? (partner_biblestudy_group_id ? Number(partner_biblestudy_group_id) : null) : existing.partner_biblestudy_group_id,
            partner_ministry_id !== undefined ? (partner_ministry_id ? Number(partner_ministry_id) : null) : existing.partner_ministry_id,
            is_joint_duty !== undefined ? Boolean(is_joint_duty) : existing.is_joint_duty,
            id
        ]);
        if (req.user) {
            await (0, auth_1.logAuditAction)(req.user.id, "UPDATE_DISHWASHING_DUTY", "dishwashing_roster", Number(id), `Updated duty #${id} status: ${status || existing.status}`);
        }
        res.json({ message: "Dishwashing duty updated successfully." });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/dishwashing/:id/swap
 * 1-Click Swap turn with another scheduled Sunday
 */
router.post("/:id/swap", auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { target_duty_id } = req.body;
        if (!target_duty_id) {
            return res.status(400).json({ error: "target_duty_id is required to swap" });
        }
        const dutyA = await schema_1.db.get("SELECT * FROM dishwashing_roster WHERE id = $1", [id]);
        const dutyB = await schema_1.db.get("SELECT * FROM dishwashing_roster WHERE id = $1", [target_duty_id]);
        if (!dutyA || !dutyB) {
            return res.status(404).json({ error: "One or both duty schedules not found." });
        }
        // Swap assigned groups and leaders
        await schema_1.db.run(`
      UPDATE dishwashing_roster
      SET 
        assigned_name = $1,
        biblestudy_group_id = $2,
        ministry_id = $3,
        leader_name = $4,
        partner_assigned_name = $5,
        partner_leader_name = $6,
        partner_biblestudy_group_id = $7,
        partner_ministry_id = $8,
        is_joint_duty = $9,
        notes = $10,
        status = 'swapped'
      WHERE id = $11
    `, [
            dutyB.assigned_name,
            dutyB.biblestudy_group_id,
            dutyB.ministry_id,
            dutyB.leader_name,
            dutyB.partner_assigned_name,
            dutyB.partner_leader_name,
            dutyB.partner_biblestudy_group_id,
            dutyB.partner_ministry_id,
            dutyB.is_joint_duty,
            `Swapped turn with ${dutyA.duty_date}`,
            dutyA.id
        ]);
        await schema_1.db.run(`
      UPDATE dishwashing_roster
      SET 
        assigned_name = $1,
        biblestudy_group_id = $2,
        ministry_id = $3,
        leader_name = $4,
        partner_assigned_name = $5,
        partner_leader_name = $6,
        partner_biblestudy_group_id = $7,
        partner_ministry_id = $8,
        is_joint_duty = $9,
        notes = $10,
        status = 'swapped'
      WHERE id = $11
    `, [
            dutyA.assigned_name,
            dutyA.biblestudy_group_id,
            dutyA.ministry_id,
            dutyA.leader_name,
            dutyA.partner_assigned_name,
            dutyA.partner_leader_name,
            dutyA.partner_biblestudy_group_id,
            dutyA.partner_ministry_id,
            dutyA.is_joint_duty,
            `Swapped turn with ${dutyB.duty_date}`,
            dutyB.id
        ]);
        if (req.user) {
            await (0, auth_1.logAuditAction)(req.user.id, "SWAP_DISHWASHING_DUTY", "dishwashing_roster", Number(id), `Swapped duty #${dutyA.id} (${dutyA.assigned_name}) with #${dutyB.id} (${dutyB.assigned_name})`);
        }
        res.json({ message: `Successfully swapped turns between ${dutyA.duty_date} and ${dutyB.duty_date}.` });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /api/dishwashing/:id
 * Delete a single duty schedule
 */
router.delete("/:id", auth_1.authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await schema_1.db.run("DELETE FROM dishwashing_roster WHERE id = $1", [id]);
        if (req.user) {
            await (0, auth_1.logAuditAction)(req.user.id, "DELETE_DISHWASHING_DUTY", "dishwashing_roster", Number(id), `Deleted duty #${id}`);
        }
        res.json({ message: "Dishwashing duty deleted." });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAge = calculateAge;
const express_1 = require("express");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Helper to compute age in years
function calculateAge(birthdateStr) {
    if (!birthdateStr)
        return 0;
    const birthdate = new Date(birthdateStr);
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const m = today.getMonth() - birthdate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
        age--;
    }
    return age;
}
// Auto-suggest ministry based on birthdate
router.get("/suggest", async (req, res) => {
    try {
        const { birthdate } = req.query;
        if (!birthdate || typeof birthdate !== "string") {
            return res.status(400).json({ error: "birthdate query param is required (YYYY-MM-DD)" });
        }
        const age = calculateAge(birthdate);
        const ministries = await schema_1.db.all("SELECT * FROM ministries ORDER BY min_age ASC");
        let matched = ministries.find(m => {
            const min = m.min_age ?? 0;
            const max = m.max_age ?? 999;
            return age >= min && age <= max;
        });
        if (!matched && ministries.length > 0) {
            matched = ministries[ministries.length - 1];
        }
        res.json({
            calculated_age: age,
            suggested_ministry: matched
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// List all ministries with summary metrics
router.get("/", async (req, res) => {
    try {
        const ministries = await schema_1.db.all("SELECT * FROM ministries ORDER BY id ASC");
        const summary = await Promise.all(ministries.map(async (m) => {
            const memberCount = await schema_1.db.get(`
        SELECT COUNT(*) as count FROM members WHERE ministry_id = $1 AND status = 'active'
      `, [m.id]);
            const coordinators = await schema_1.db.all(`
        SELECT u.id, u.name, u.email
        FROM users u
        JOIN user_ministries um ON u.id = um.user_id
        WHERE um.ministry_id = $1 AND u.role_id = 2
      `, [m.id]);
            const volunteers = await schema_1.db.all(`
        SELECT u.id, u.name, u.email
        FROM users u
        JOIN user_ministries um ON u.id = um.user_id
        WHERE um.ministry_id = $1 AND u.role_id = 3
      `, [m.id]);
            const todayCheckins = await schema_1.db.get(`
        SELECT COUNT(*) as count FROM attendance
        WHERE ministry_id = $1 AND DATE(checked_in_at) = CURRENT_DATE
      `, [m.id]);
            return {
                ...m,
                active_members_count: Number(memberCount?.count || 0),
                coordinators,
                volunteers,
                today_checkins_count: Number(todayCheckins?.count || 0)
            };
        }));
        res.json(summary);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get specific ministry details
router.get("/:id", async (req, res) => {
    try {
        const ministry = await schema_1.db.get("SELECT * FROM ministries WHERE id = $1", [req.params.id]);
        if (!ministry) {
            return res.status(404).json({ error: "Ministry not found" });
        }
        const members = await schema_1.db.all(`
      SELECT m.*, h.name as household_name
      FROM members m
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.ministry_id = $1
      ORDER BY m.last_name ASC, m.first_name ASC
    `, [ministry.id]);
        const upcomingEvents = await schema_1.db.all(`
      SELECT * FROM events
      WHERE (ministry_id = $1 OR ministry_id IS NULL)
        AND start_time >= CURRENT_TIMESTAMP
      ORDER BY start_time ASC
      LIMIT 5
    `, [ministry.id]);
        res.json({
            ...ministry,
            members,
            upcoming_events: upcomingEvents
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Create ministry (Admin only)
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin"), async (req, res) => {
    try {
        const { name, min_age, max_age, description, color = "#2C3968" } = req.body;
        if (!name)
            return res.status(400).json({ error: "Ministry name is required" });
        const existing = await schema_1.db.get("SELECT id FROM ministries WHERE LOWER(name) = LOWER($1)", [name.trim()]);
        if (existing)
            return res.status(400).json({ error: "A ministry with this name already exists" });
        const result = await schema_1.db.run(`
      INSERT INTO ministries (name, min_age, max_age, description, color)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
            name.trim(),
            min_age !== undefined && min_age !== "" ? Number(min_age) : null,
            max_age !== undefined && max_age !== "" ? Number(max_age) : null,
            description || null,
            color
        ]);
        const newId = result.lastInsertRowid;
        await (0, auth_1.logAuditAction)(req.user?.id || null, "CREATE", "ministries", newId, `Created ministry ${name.trim()}`);
        res.status(201).json({ id: newId, message: "Ministry created successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update ministry details (Admin only)
router.put("/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin"), async (req, res) => {
    try {
        const { name, min_age, max_age, description, color } = req.body;
        const id = req.params.id;
        const current = await schema_1.db.get("SELECT * FROM ministries WHERE id = $1", [id]);
        if (!current)
            return res.status(404).json({ error: "Ministry not found" });
        if (name && name.trim().toLowerCase() !== current.name.toLowerCase()) {
            const duplicate = await schema_1.db.get("SELECT id FROM ministries WHERE LOWER(name) = LOWER($1) AND id != $2", [name.trim(), id]);
            if (duplicate)
                return res.status(400).json({ error: "Another ministry already has this name" });
        }
        await schema_1.db.run(`
      UPDATE ministries
      SET name = COALESCE($1, name),
          min_age = COALESCE($2, min_age),
          max_age = COALESCE($3, max_age),
          description = COALESCE($4, description),
          color = COALESCE($5, color)
      WHERE id = $6
    `, [
            name !== undefined ? name.trim() : null,
            min_age !== undefined && min_age !== "" ? Number(min_age) : null,
            max_age !== undefined && max_age !== "" ? Number(max_age) : null,
            description !== undefined ? description : null,
            color !== undefined ? color : null,
            id
        ]);
        await (0, auth_1.logAuditAction)(req.user?.id || null, "UPDATE", "ministries", Number(id), `Updated ministry ${name || current.name}`);
        res.json({ message: "Ministry updated successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Delete ministry (Admin only)
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin"), async (req, res) => {
    try {
        const id = req.params.id;
        const current = await schema_1.db.get("SELECT * FROM ministries WHERE id = $1", [id]);
        if (!current)
            return res.status(404).json({ error: "Ministry not found" });
        await schema_1.db.run("UPDATE members SET ministry_id = NULL WHERE ministry_id = $1", [id]);
        await schema_1.db.run("DELETE FROM user_ministries WHERE ministry_id = $1", [id]);
        await schema_1.db.run("DELETE FROM ministries WHERE id = $1", [id]);
        await (0, auth_1.logAuditAction)(req.user?.id || null, "DELETE", "ministries", Number(id), `Deleted ministry ${current.name}`);
        res.json({ message: `Ministry '${current.name}' deleted successfully` });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;

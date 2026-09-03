"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// List Bible study groups with members
router.get("/", async (req, res) => {
    try {
        const { ministry_id, category, meeting_day, search } = req.query;
        let query = `
      SELECT g.*, min.name as ministry_name, min.color as ministry_color,
             (SELECT COUNT(*) FROM bible_study_members WHERE group_id = g.id) as current_member_count
      FROM bible_study_groups g
      LEFT JOIN ministries min ON g.ministry_id = min.id
      WHERE 1=1
    `;
        const params = [];
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
        const groups = await schema_1.db.all(query, params);
        const detailed = await Promise.all(groups.map(async (g) => {
            const members = await schema_1.db.all(`
        SELECT bsm.*, m.first_name, m.last_name, m.contact_email, m.contact_phone
        FROM bible_study_members bsm
        LEFT JOIN members m ON bsm.member_id = m.id
        WHERE bsm.group_id = $1
        ORDER BY bsm.joined_at ASC
      `, [g.id]);
            return {
                ...g,
                current_member_count: Number(g.current_member_count || 0),
                members: members.map(m => ({
                    ...m,
                    display_name: m.first_name ? `${m.first_name} ${m.last_name}` : m.member_name
                }))
            };
        }));
        res.json(detailed);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get specific group
router.get("/:id", async (req, res) => {
    try {
        const group = await schema_1.db.get(`
      SELECT g.*, min.name as ministry_name, min.color as ministry_color
      FROM bible_study_groups g
      LEFT JOIN ministries min ON g.ministry_id = min.id
      WHERE g.id = $1
    `, [req.params.id]);
        if (!group) {
            return res.status(404).json({ error: "Small group not found" });
        }
        const members = await schema_1.db.all(`
      SELECT bsm.*, m.first_name, m.last_name, m.contact_email, m.contact_phone
      FROM bible_study_members bsm
      LEFT JOIN members m ON bsm.member_id = m.id
      WHERE bsm.group_id = $1
      ORDER BY bsm.joined_at ASC
    `, [group.id]);
        res.json({
            ...group,
            members: members.map(m => ({
                ...m,
                display_name: m.first_name ? `${m.first_name} ${m.last_name}` : m.member_name
            }))
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Create group (Admin / Coordinator)
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const { name, description, curriculum, ministry_id, leader_name, leader_contact, meeting_day, meeting_time, location, category = "General", max_capacity = 12 } = req.body;
        if (!name || !leader_name || !meeting_day || !meeting_time || !location) {
            return res.status(400).json({ error: "Group name, leader name, day, time, and location are required" });
        }
        const result = await schema_1.db.run(`
      INSERT INTO bible_study_groups (name, description, curriculum, ministry_id, leader_name, leader_contact, meeting_day, meeting_time, location, category, max_capacity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
            Number(max_capacity) || 12
        ]);
        const newId = result.lastInsertRowid;
        await (0, auth_1.logAuditAction)(req.user?.id || null, "CREATE", "bible_study_groups", newId, `Created Bible study group: ${name}`);
        res.status(201).json({ id: newId, message: "Small group created successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update group
router.put("/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const id = req.params.id;
        const { name, description, curriculum, ministry_id, leader_name, leader_contact, meeting_day, meeting_time, location, category, max_capacity } = req.body;
        const current = await schema_1.db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
        if (!current)
            return res.status(404).json({ error: "Small group not found" });
        await schema_1.db.run(`
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
          max_capacity = COALESCE($11, max_capacity)
      WHERE id = $12
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
            id
        ]);
        await (0, auth_1.logAuditAction)(req.user?.id || null, "UPDATE", "bible_study_groups", Number(id), `Updated small group: ${name || current.name}`);
        res.json({ message: "Small group updated successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Delete group
router.delete("/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const id = req.params.id;
        await schema_1.db.run("DELETE FROM bible_study_members WHERE group_id = $1", [id]);
        await schema_1.db.run("DELETE FROM bible_study_groups WHERE id = $1", [id]);
        await (0, auth_1.logAuditAction)(req.user?.id || null, "DELETE", "bible_study_groups", Number(id), `Deleted small group #${id}`);
        res.json({ message: "Small group deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Join group
router.post("/:id/join", auth_1.authMiddleware, async (req, res) => {
    try {
        const groupId = req.params.id;
        const { member_id, member_name } = req.body;
        let targetMemberId = member_id;
        let targetName = member_name;
        if (!targetMemberId && req.user) {
            const linkedMember = await schema_1.db.get("SELECT * FROM members WHERE user_id = $1", [req.user.id]);
            if (linkedMember) {
                targetMemberId = linkedMember.id;
                targetName = `${linkedMember.first_name} ${linkedMember.last_name}`;
            }
            else {
                targetName = req.user.name;
            }
        }
        if (targetMemberId) {
            const existing = await schema_1.db.get("SELECT * FROM bible_study_members WHERE group_id = $1 AND member_id = $2", [groupId, targetMemberId]);
            if (existing) {
                return res.status(400).json({ error: "You are already a member of this small group." });
            }
        }
        await schema_1.db.run(`
      INSERT INTO bible_study_members (group_id, member_id, member_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (group_id, member_id) DO NOTHING
    `, [groupId, targetMemberId || null, targetName || "Member"]);
        res.json({ message: "Joined small group successfully!" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;

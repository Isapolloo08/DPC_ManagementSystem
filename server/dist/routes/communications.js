"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// List announcements
router.get("/announcements", async (req, res) => {
    try {
        const { ministry_id } = req.query;
        let query = `
      SELECT a.*, 
             min.name as ministry_name, min.color as ministry_color,
             u.name as author_name, r.name as author_role
      FROM announcements a
      LEFT JOIN ministries min ON a.ministry_id = min.id
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE 1=1
    `;
        const params = [];
        if (ministry_id) {
            params.push(ministry_id);
            query += ` AND (a.ministry_id = $${params.length} OR a.ministry_id IS NULL)`;
        }
        query += " ORDER BY a.is_pinned DESC, a.created_at DESC";
        const announcements = await schema_1.db.all(query, params);
        res.json(announcements);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Create announcement
router.post("/announcements", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const { ministry_id, title, body, is_pinned = false } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: "Title and body are required" });
        }
        // Coordinator can only post to their assigned ministry
        if (req.user.role_name === "Coordinator") {
            if (!ministry_id || !req.user.ministry_ids.includes(Number(ministry_id))) {
                return res.status(403).json({ error: "Coordinators can only post announcements for their assigned ministry" });
            }
        }
        const result = await schema_1.db.run(`
      INSERT INTO announcements (ministry_id, author_id, title, body, is_pinned)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [ministry_id || null, req.user.id, title, body, Boolean(is_pinned)]);
        const newId = result.lastInsertRowid;
        await (0, auth_1.logAuditAction)(req.user.id, "CREATE", "announcements", newId, `Created announcement: ${title}`);
        res.status(201).json({ id: newId, message: "Announcement created successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Delete announcement
router.delete("/announcements/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const id = req.params.id;
        await schema_1.db.run("DELETE FROM announcements WHERE id = $1", [id]);
        await (0, auth_1.logAuditAction)(req.user.id, "DELETE", "announcements", Number(id), `Deleted announcement #${id}`);
        res.json({ message: "Announcement deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// List prayer requests
router.get("/prayer-requests", async (req, res) => {
    try {
        const { ministry_id, status } = req.query;
        let query = `
      SELECT p.*,
             min.name as ministry_name, min.color as ministry_color,
             CASE WHEN p.is_anonymous = TRUE THEN 'Anonymous Member' 
                  ELSE (m.first_name || ' ' || m.last_name) END as submitter_name
      FROM prayer_requests p
      LEFT JOIN ministries min ON p.ministry_id = min.id
      LEFT JOIN members m ON p.member_id = m.id
      WHERE 1=1
    `;
        const params = [];
        if (ministry_id) {
            params.push(ministry_id);
            query += ` AND (p.ministry_id = $${params.length} OR p.ministry_id IS NULL)`;
        }
        if (status && status !== "all") {
            params.push(status);
            query += ` AND p.status = $${params.length}`;
        }
        query += " ORDER BY p.created_at DESC";
        const prayers = await schema_1.db.all(query, params);
        res.json(prayers);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Submit prayer request
router.post("/prayer-requests", auth_1.authMiddleware, async (req, res) => {
    try {
        const { ministry_id, request_text, is_anonymous = false, member_id } = req.body;
        if (!request_text) {
            return res.status(400).json({ error: "Request text is required" });
        }
        let targetMemberId = member_id;
        if (!targetMemberId && !is_anonymous) {
            const linkedMember = await schema_1.db.get("SELECT id FROM members WHERE user_id = $1", [req.user.id]);
            if (linkedMember)
                targetMemberId = linkedMember.id;
        }
        const result = await schema_1.db.run(`
      INSERT INTO prayer_requests (member_id, ministry_id, request_text, is_anonymous, status)
      VALUES ($1, $2, $3, $4, 'open')
      RETURNING id
    `, [
            is_anonymous ? null : (targetMemberId || null),
            ministry_id || null,
            request_text,
            Boolean(is_anonymous)
        ]);
        const newId = result.lastInsertRowid;
        res.status(201).json({ id: newId, message: "Prayer request submitted successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update prayer request status (open/answered/archived)
router.patch("/prayer-requests/:id/status", auth_1.authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const id = req.params.id;
        if (!["open", "answered", "archived"].includes(status)) {
            return res.status(400).json({ error: "Invalid status value" });
        }
        await schema_1.db.run("UPDATE prayer_requests SET status = $1 WHERE id = $2", [status, id]);
        res.json({ message: "Prayer request status updated", status });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;

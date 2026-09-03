"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// List all funds with financial progress
router.get("/funds", async (req, res) => {
    try {
        const funds = await schema_1.db.all("SELECT * FROM funds ORDER BY id ASC");
        const enriched = await Promise.all(funds.map(async (f) => {
            const totalRaised = await schema_1.db.get(`
        SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE fund_id = $1
      `, [f.id]);
            const donorCount = await schema_1.db.get(`
        SELECT COUNT(DISTINCT member_id) as count FROM donations WHERE fund_id = $1
      `, [f.id]);
            const raised = Number(totalRaised?.total || 0);
            const target = Number(f.target_amount || 0);
            const percentage = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 100;
            return {
                ...f,
                target_amount: target,
                raised_amount: raised,
                donor_count: Number(donorCount?.count || 0),
                progress_percentage: percentage
            };
        }));
        res.json(enriched);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Create new fund (Admin only)
router.post("/funds", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin"), async (req, res) => {
    try {
        const { name, description, target_amount = 0 } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Fund name is required" });
        }
        const result = await schema_1.db.run(`
      INSERT INTO funds (name, description, target_amount)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [name, description || null, Number(target_amount) || 0]);
        const newId = result.lastInsertRowid;
        await (0, auth_1.logAuditAction)(req.user.id, "CREATE", "funds", newId, `Created fund: ${name}`);
        res.status(201).json({ id: newId, message: "Fund created successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update fund
router.put("/funds/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin"), async (req, res) => {
    try {
        const id = req.params.id;
        const { name, description, target_amount } = req.body;
        await schema_1.db.run(`
      UPDATE funds
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          target_amount = COALESCE($3, target_amount)
      WHERE id = $4
    `, [name, description, target_amount !== undefined ? Number(target_amount) : null, id]);
        await (0, auth_1.logAuditAction)(req.user.id, "UPDATE", "funds", Number(id), `Updated fund #${id}`);
        res.json({ message: "Fund updated successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Delete fund
router.delete("/funds/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin"), async (req, res) => {
    try {
        const id = req.params.id;
        await schema_1.db.run("DELETE FROM funds WHERE id = $1", [id]);
        await (0, auth_1.logAuditAction)(req.user.id, "DELETE", "funds", Number(id), `Deleted fund #${id}`);
        res.json({ message: "Fund deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// List donations (Admin sees all; Member sees only personal giving)
router.get("/donations", auth_1.authMiddleware, async (req, res) => {
    try {
        const { fund_id, member_id } = req.query;
        let query = `
      SELECT d.*, 
             f.name as fund_name,
             m.first_name, m.last_name, m.contact_email
      FROM donations d
      JOIN funds f ON d.fund_id = f.id
      LEFT JOIN members m ON d.member_id = m.id
      WHERE 1=1
    `;
        const params = [];
        // Scoping: If user is Member, only show their linked member records
        if (req.user.role_name === "Member") {
            const linkedMember = await schema_1.db.get("SELECT id FROM members WHERE user_id = $1", [req.user.id]);
            if (!linkedMember) {
                return res.json([]);
            }
            params.push(linkedMember.id);
            query += ` AND d.member_id = $${params.length}`;
        }
        else if (member_id) {
            params.push(member_id);
            query += ` AND d.member_id = $${params.length}`;
        }
        if (fund_id) {
            params.push(fund_id);
            query += ` AND d.fund_id = $${params.length}`;
        }
        query += " ORDER BY d.donated_at DESC";
        const donations = await schema_1.db.all(query, params);
        const formatted = donations.map(d => ({
            ...d,
            amount: Number(d.amount)
        }));
        res.json(formatted);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Record a donation
router.post("/donations", auth_1.authMiddleware, async (req, res) => {
    try {
        const { member_id, fund_id, amount, method = "online", notes } = req.body;
        if (!fund_id || !amount || Number(amount) <= 0) {
            return res.status(400).json({ error: "Valid fund_id and positive amount are required" });
        }
        let targetMemberId = member_id;
        if (!targetMemberId && req.user?.role_name === "Member") {
            const linkedMember = await schema_1.db.get("SELECT id FROM members WHERE user_id = $1", [req.user.id]);
            if (linkedMember)
                targetMemberId = linkedMember.id;
        }
        const result = await schema_1.db.run(`
      INSERT INTO donations (member_id, fund_id, amount, method, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
            targetMemberId || null,
            fund_id,
            Number(amount),
            method,
            notes || null
        ]);
        const newId = result.lastInsertRowid;
        await (0, auth_1.logAuditAction)(req.user.id, "DONATION", "donations", newId, `Recorded donation of $${amount} to fund #${fund_id}`);
        res.status(201).json({ id: newId, message: "Donation recorded successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Generate tax giving statement for member
router.get("/statement/:memberId", auth_1.authMiddleware, async (req, res) => {
    try {
        const memberId = req.params.memberId;
        const year = req.query.year || new Date().getFullYear();
        const member = await schema_1.db.get(`
      SELECT m.*, h.name as household_name, h.address as household_address
      FROM members m
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.id = $1
    `, [memberId]);
        if (!member) {
            return res.status(404).json({ error: "Member not found" });
        }
        // Scoping: Member can only view their own statement
        if (req.user.role_name === "Member" && member.user_id !== req.user.id) {
            return res.status(403).json({ error: "Access denied" });
        }
        const items = await schema_1.db.all(`
      SELECT d.id, d.amount, d.method, d.donated_at, d.notes, f.name as fund_name
      FROM donations d
      JOIN funds f ON d.fund_id = f.id
      WHERE d.member_id = $1 AND to_char(d.donated_at, 'YYYY') = $2
      ORDER BY d.donated_at ASC
    `, [memberId, String(year)]);
        const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
        res.json({
            statement_year: year,
            issued_date: new Date().toISOString(),
            organization: "Daet Presbyterian Church ChMS",
            tax_id: "DPC-SEC-501C3-1984",
            member: {
                id: member.id,
                name: `${member.first_name} ${member.last_name}`,
                email: member.contact_email,
                phone: member.contact_phone,
                address: member.household_address || "On File"
            },
            total_giving: total,
            records: items.map(i => ({ ...i, amount: Number(i.amount) }))
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;

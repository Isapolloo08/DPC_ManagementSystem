"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const ministries_1 = require("./ministries");
const router = (0, express_1.Router)();
// List households with member summaries
router.get("/", async (req, res) => {
    try {
        const households = await schema_1.db.all(`
      SELECT h.*, COUNT(m.id) as member_count
      FROM households h
      LEFT JOIN members m ON h.id = m.household_id
      GROUP BY h.id
      ORDER BY h.name ASC
    `);
        const detailed = await Promise.all(households.map(async (h) => {
            const members = await schema_1.db.all(`
        SELECT m.id, m.first_name, m.last_name, m.birthdate, m.gender, min.name as ministry_name, min.color as ministry_color
        FROM members m
        LEFT JOIN ministries min ON m.ministry_id = min.id
        WHERE m.household_id = $1
        ORDER BY m.birthdate ASC
      `, [h.id]);
            const enrichedMembers = members.map(m => {
                const bStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
                return {
                    ...m,
                    birthdate: bStr,
                    age: (0, ministries_1.calculateAge)(bStr)
                };
            });
            return {
                ...h,
                member_count: Number(h.member_count || 0),
                members: enrichedMembers
            };
        }));
        res.json(detailed);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get specific household
router.get("/:id", async (req, res) => {
    try {
        const household = await schema_1.db.get("SELECT * FROM households WHERE id = $1", [req.params.id]);
        if (!household) {
            return res.status(404).json({ error: "Household not found" });
        }
        const members = await schema_1.db.all(`
      SELECT m.*, min.name as ministry_name, min.color as ministry_color
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      WHERE m.household_id = $1
      ORDER BY m.birthdate ASC
    `, [household.id]);
        res.json({
            ...household,
            members: members.map(m => {
                const bStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
                return {
                    ...m,
                    birthdate: bStr,
                    age: (0, ministries_1.calculateAge)(bStr)
                };
            })
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Create household
router.post("/", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const { name, address, primary_contact_phone } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Household name is required" });
        }
        const result = await schema_1.db.run(`
      INSERT INTO households (name, address, primary_contact_phone)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [name, address || null, primary_contact_phone || null]);
        const newId = result.lastInsertRowid;
        await (0, auth_1.logAuditAction)(req.user?.id || null, "CREATE", "households", newId, `Created household: ${name}`);
        res.status(201).json({ id: newId, message: "Household created successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update household
router.put("/:id", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin", "Coordinator"), async (req, res) => {
    try {
        const { name, address, primary_contact_phone } = req.body;
        const id = req.params.id;
        await schema_1.db.run(`
      UPDATE households
      SET name = COALESCE($1, name),
          address = COALESCE($2, address),
          primary_contact_phone = COALESCE($3, primary_contact_phone)
      WHERE id = $4
    `, [name, address, primary_contact_phone, id]);
        await (0, auth_1.logAuditAction)(req.user?.id || null, "UPDATE", "households", Number(id), `Updated household #${id}`);
        res.json({ message: "Household updated successfully" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;

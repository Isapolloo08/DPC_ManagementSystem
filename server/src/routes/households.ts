import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { calculateAge } from "./ministries";
import { emitRealtimeEvent } from "../socket";

const router = Router();

// List households with member summaries (Optimized: 0 N+1 roundtrips)
router.get("/", async (req: Request, res: Response) => {
  try {
    const [households, allMembers] = await Promise.all([
      db.all(`SELECT * FROM households ORDER BY name ASC`),
      db.all(`
        SELECT m.id, m.household_id, m.first_name, m.last_name, m.birthdate, m.gender, min.name as ministry_name, min.color as ministry_color
        FROM members m
        LEFT JOIN ministries min ON m.ministry_id = min.id
        WHERE m.household_id IS NOT NULL
        ORDER BY LOWER(m.first_name) ASC, LOWER(m.last_name) ASC
      `)
    ]);

    // Group members by household_id in memory
    const membersByHousehold = new Map<number, any[]>();
    for (const m of allMembers) {
      const hId = m.household_id;
      if (!membersByHousehold.has(hId)) membersByHousehold.set(hId, []);
      const bStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
      membersByHousehold.get(hId)!.push({
        ...m,
        birthdate: bStr,
        age: calculateAge(bStr)
      });
    }

    const detailed = households.map((h) => {
      const members = membersByHousehold.get(h.id) || [];
      return {
        ...h,
        member_count: members.length,
        members
      };
    });

    res.json(detailed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific household
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const household = await db.get("SELECT * FROM households WHERE id = $1", [req.params.id]);
    if (!household) {
      return res.status(404).json({ error: "Household not found" });
    }

    const members = await db.all(`
      SELECT m.*, min.name as ministry_name, min.color as ministry_color
      FROM members m
      LEFT JOIN ministries min ON m.ministry_id = min.id
      WHERE m.household_id = $1
      ORDER BY LOWER(m.first_name) ASC, LOWER(m.last_name) ASC
    `, [household.id]);

    res.json({
      ...household,
      members: members.map(m => {
        const bStr = m.birthdate ? (typeof m.birthdate === "string" ? m.birthdate : new Date(m.birthdate).toISOString().split("T")[0]) : "";
        return {
          ...m,
          birthdate: bStr,
          age: calculateAge(bStr)
        };
      })
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create household
router.post("/", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, primary_contact_phone } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: "Household name is required" });
    }

    const existing = await db.get("SELECT id FROM households WHERE LOWER(name) = LOWER($1)", [name.trim()]);
    if (existing) {
      return res.status(400).json({ error: "A household with this name already exists" });
    }

    const result = await db.run(`
      INSERT INTO households (name, address, primary_contact_phone)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [name.trim(), address || null, primary_contact_phone || null]);

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user?.id || null, "CREATE", "households", newId, `Created household: ${name}`);
    emitRealtimeEvent("households:changed", { action: "create", id: newId });
    emitRealtimeEvent("members:changed");

    res.status(201).json({ id: newId, message: "Household created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update household
router.put("/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, primary_contact_phone } = req.body;
    const id = req.params.id;

    if (name) {
      if (!name.trim()) {
        return res.status(400).json({ error: "Household name cannot be empty" });
      }
      const existing = await db.get("SELECT id FROM households WHERE LOWER(name) = LOWER($1) AND id != $2", [name.trim(), id]);
      if (existing) {
        return res.status(400).json({ error: "A household with this name already exists" });
      }
    }

    await db.run(`
      UPDATE households
      SET name = COALESCE($1, name),
          address = COALESCE($2, address),
          primary_contact_phone = COALESCE($3, primary_contact_phone)
      WHERE id = $4
    `, [name?.trim() || null, address, primary_contact_phone, id]);

    await logAuditAction(req.user?.id || null, "UPDATE", "households", Number(id), `Updated household #${id}`);
    emitRealtimeEvent("households:changed", { action: "update", id: Number(id) });
    emitRealtimeEvent("members:changed");
    res.json({ message: "Household updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

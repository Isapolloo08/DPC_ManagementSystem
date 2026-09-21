import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";
import { cache, cacheMiddleware } from "../utils/cache";

const router = Router();

// Helper to compute age in years
export function calculateAge(birthdateStr: string): number {
  if (!birthdateStr) return 0;
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
router.get("/suggest", async (req: Request, res: Response) => {
  try {
    const { birthdate } = req.query;
    if (!birthdate || typeof birthdate !== "string") {
      return res.status(400).json({ error: "birthdate query param is required (YYYY-MM-DD)" });
    }

    const age = calculateAge(birthdate);
    const ministries = await db.all("SELECT * FROM ministries ORDER BY min_age ASC");

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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all ministries with summary metrics (Optimized: 0 N+1 roundtrips, cached for 2 min with ETag)
router.get("/", cacheMiddleware("ministries", 120), async (req: Request, res: Response) => {
  try {
    const ministriesSql = `
      SELECT 
        m.*,
        COALESCE(mem.member_count, 0) as active_members_count,
        COALESCE(att.today_checkins, 0) as today_checkins_count
      FROM ministries m
      LEFT JOIN (
        SELECT ministry_id, COUNT(*) as member_count
        FROM members
        WHERE status = 'active'
        GROUP BY ministry_id
      ) mem ON mem.ministry_id = m.id
      LEFT JOIN (
        SELECT ministry_id, COUNT(*) as today_checkins
        FROM attendance
        WHERE checked_in_at::date = CURRENT_DATE
        GROUP BY ministry_id
      ) att ON att.ministry_id = m.id
      ORDER BY m.id ASC
    `;

    const userMinistriesSql = `
      SELECT u.id, u.name, u.email, u.role_id, um.ministry_id
      FROM users u
      JOIN user_ministries um ON u.id = um.user_id
      WHERE u.role_id IN (2, 3)
    `;

    const [ministries, staffUsers] = await Promise.all([
      db.all(ministriesSql),
      db.all(userMinistriesSql)
    ]);

    // Group staff users in memory by ministry_id
    const coordinatorsByMin = new Map<number, any[]>();
    const volunteersByMin = new Map<number, any[]>();

    for (const u of staffUsers) {
      const minId = u.ministry_id;
      const userItem = { id: u.id, name: u.name, email: u.email };
      if (u.role_id === 2) {
        if (!coordinatorsByMin.has(minId)) coordinatorsByMin.set(minId, []);
        coordinatorsByMin.get(minId)!.push(userItem);
      } else if (u.role_id === 3) {
        if (!volunteersByMin.has(minId)) volunteersByMin.set(minId, []);
        volunteersByMin.get(minId)!.push(userItem);
      }
    }

    const summary = ministries.map((m) => ({
      ...m,
      active_members_count: Number(m.active_members_count || 0),
      coordinators: coordinatorsByMin.get(m.id) || [],
      volunteers: volunteersByMin.get(m.id) || [],
      today_checkins_count: Number(m.today_checkins_count || 0)
    }));

    res.json(summary);
  } catch (err: any) {
    console.error("GET /api/ministries error:", err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Get specific ministry details
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const ministry = await db.get("SELECT * FROM ministries WHERE id = $1", [req.params.id]);
    if (!ministry) {
      return res.status(404).json({ error: "Ministry not found" });
    }

    const members = await db.all(`
      SELECT m.*, h.name as household_name
      FROM members m
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.ministry_id = $1
      ORDER BY LOWER(m.first_name) ASC, LOWER(m.last_name) ASC
    `, [ministry.id]);

    const upcomingEvents = await db.all(`
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create ministry (Admin only)
router.post("/", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, min_age, max_age, description, color = "#2C3968" } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Ministry name is required" });

    const existing = await db.get("SELECT id FROM ministries WHERE LOWER(name) = LOWER($1)", [name.trim()]);
    if (existing) return res.status(400).json({ error: "A ministry with this name already exists" });

    const minNum = min_age !== undefined && min_age !== "" && min_age !== null ? Number(min_age) : null;
    const maxNum = max_age !== undefined && max_age !== "" && max_age !== null ? Number(max_age) : null;
    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      return res.status(400).json({ error: "Minimum age cannot be greater than maximum age" });
    }

    const result = await db.run(`
      INSERT INTO ministries (name, min_age, max_age, description, color)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      name.trim(),
      minNum,
      maxNum,
      description || null,
      color
    ]);

    const newId = result.lastInsertRowid;
    cache.invalidate("ministries");
    await logAuditAction(req.user?.id || null, "CREATE", "ministries", newId, `Created ministry ${name.trim()}`);
    emitRealtimeEvent("ministries:changed", { action: "create", id: newId });
    res.status(201).json({ id: newId, message: "Ministry created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update ministry details (Admin only)
router.put("/:id", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, min_age, max_age, description, color } = req.body;
    const id = req.params.id;

    const current = await db.get("SELECT * FROM ministries WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Ministry not found" });

    if (name && name.trim().toLowerCase() !== current.name.toLowerCase()) {
      const duplicate = await db.get("SELECT id FROM ministries WHERE LOWER(name) = LOWER($1) AND id != $2", [name.trim(), id]);
      if (duplicate) return res.status(400).json({ error: "Another ministry already has this name" });
    }

    const hasMinAge = "min_age" in req.body;
    const hasMaxAge = "max_age" in req.body;
    const minAgeVal = hasMinAge ? (min_age !== null && min_age !== "" && min_age !== undefined ? Number(min_age) : null) : current.min_age;
    const maxAgeVal = hasMaxAge ? (max_age !== null && max_age !== "" && max_age !== undefined ? Number(max_age) : null) : current.max_age;

    if (minAgeVal !== null && maxAgeVal !== null && minAgeVal > maxAgeVal) {
      return res.status(400).json({ error: "Minimum age cannot be greater than maximum age" });
    }

    await db.run(`
      UPDATE ministries
      SET name = COALESCE($1, name),
          min_age = $2,
          max_age = $3,
          description = COALESCE($4, description),
          color = COALESCE($5, color)
      WHERE id = $6
    `, [
      name !== undefined ? name.trim() : null,
      minAgeVal,
      maxAgeVal,
      description !== undefined ? description : null,
      color !== undefined ? color : null,
      id
    ]);

    cache.invalidate("ministries");
    await logAuditAction(req.user?.id || null, "UPDATE", "ministries", Number(id), `Updated ministry ${name || current.name} age range (${minAgeVal ?? 'all'}-${maxAgeVal ?? 'all'})`);
    
    // Emit real-time events so all pages recalculate members aging-out, ministry metrics, and reports
    emitRealtimeEvent("ministries:changed", { action: "update", id: Number(id) });
    emitRealtimeEvent("members:changed", { action: "ministry_age_update", ministry_id: Number(id) });
    emitRealtimeEvent("reports:changed");
    emitRealtimeEvent("settings:changed");

    res.json({ message: "Ministry updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete ministry (Admin only)
router.delete("/:id", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const current = await db.get("SELECT * FROM ministries WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Ministry not found" });

    await db.run("UPDATE members SET ministry_id = NULL WHERE ministry_id = $1", [id]);
    await db.run("DELETE FROM user_ministries WHERE ministry_id = $1", [id]);
    await db.run("DELETE FROM ministries WHERE id = $1", [id]);

    cache.invalidate("ministries");
    await logAuditAction(req.user?.id || null, "DELETE", "ministries", Number(id), `Deleted ministry ${current.name}`);
    emitRealtimeEvent("ministries:changed", { action: "delete", id: Number(id) });
    res.json({ message: `Ministry '${current.name}' deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

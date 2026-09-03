import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";

const router = Router();

// Default fallback lookups
const DEFAULT_LOOKUPS = [
  // Bible study categories
  { type: "bible_study_category", name: "General", description: "General fellowship & Bible study groups", color: "#2C3968", sort_order: 1 },
  { type: "bible_study_category", name: "Men's Group", description: "Men of integrity, fatherhood & spiritual leadership", color: "#1E40AF", sort_order: 2 },
  { type: "bible_study_category", name: "Women's Group", description: "Women of grace, encouragement & prayer", color: "#BE185D", sort_order: 3 },
  { type: "bible_study_category", name: "Youth", description: "Teens & high school discipleship", color: "#059669", sort_order: 4 },
  { type: "bible_study_category", name: "Young Professionals", description: "Career navigation, dating & marketplace faith", color: "#D97706", sort_order: 5 },
  { type: "bible_study_category", name: "Couples / Family", description: "Marriage enrichment and parenting", color: "#7C3AED", sort_order: 6 },
  { type: "bible_study_category", name: "Seniors", description: "Golden age prayer and wisdom circle", color: "#92400E", sort_order: 7 },

  // Event locations
  { type: "event_location", name: "Main Sanctuary", description: "Primary worship center (capacity 350)", color: "#2C3968", sort_order: 1 },
  { type: "event_location", name: "Room 102 (Children Wing)", description: "Children classrooms & nursery", color: "#E07A5F", sort_order: 2 },
  { type: "event_location", name: "Gymnasium Annex", description: "Multi-purpose recreational hall", color: "#D9A441", sort_order: 3 },
  { type: "event_location", name: "Youth Loft Center", description: "Second floor youth meeting room", color: "#6E8B74", sort_order: 4 },
  { type: "event_location", name: "Fellowship Hall Cafe", description: "Dining area and informal lounge", color: "#4A5568", sort_order: 5 },

  // Event categories
  { type: "event_category", name: "Sunday Worship", description: "Weekly Sunday divine worship service", color: "#2C3968", sort_order: 1 },
  { type: "event_category", name: "Midweek Prayer", description: "Wednesday corporate prayer and intercession", color: "#1E40AF", sort_order: 2 },
  { type: "event_category", name: "Youth Night", description: "Saturday youth fellowship & games", color: "#059669", sort_order: 3 },
  { type: "event_category", name: "Family Fellowship", description: "Church-wide potluck and community gathering", color: "#D9A441", sort_order: 4 },
  { type: "event_category", name: "Leadership Meeting", description: "Session and ministry leader strategy", color: "#7C3AED", sort_order: 5 },
  { type: "event_category", name: "Community Outreach", description: "Medical mission, feeding, and charity work", color: "#E07A5F", sort_order: 6 },

  // Prayer & Announcement topics
  { type: "prayer_topic", name: "Healing & Health", description: "Physical, emotional, and mental healing", color: "#BE185D", sort_order: 1 },
  { type: "prayer_topic", name: "Family & Marriage", description: "Parenting, marital peace, and home blessings", color: "#7C3AED", sort_order: 2 },
  { type: "prayer_topic", name: "Financial Provision", description: "Employment, business, and debt freedom", color: "#059669", sort_order: 3 },
  { type: "prayer_topic", name: "Spiritual Growth", description: "Discipleship, devotion, and sanctification", color: "#1E40AF", sort_order: 4 },
  { type: "prayer_topic", name: "Church & Missions", description: "Pastors, church plants, and missionary support", color: "#D97706", sort_order: 5 },

  { type: "announcement_category", name: "General Announcement", description: "Important church-wide notices", color: "#2C3968", sort_order: 1 },
  { type: "announcement_category", name: "Ministry Update", description: "Reports from departments and coordinators", color: "#059669", sort_order: 2 },
  { type: "announcement_category", name: "Urgent Prayer", description: "Immediate intercession requests", color: "#BE185D", sort_order: 3 },
  { type: "announcement_category", name: "Volunteer Opportunity", description: "Calls for service helpers and teachers", color: "#D97706", sort_order: 4 },

  // Member statuses
  { type: "member_status", name: "Active Member", description: "Regular attendee with covenant commitment", color: "#059669", sort_order: 1 },
  { type: "member_status", name: "Regular Attendee", description: "Attends services regularly, not yet formal member", color: "#1E40AF", sort_order: 2 },
  { type: "member_status", name: "Visitor / Guest", description: "First-time or occasional visitor", color: "#D97706", sort_order: 3 },
  { type: "member_status", name: "Inactive", description: "Has not attended in past 6 months", color: "#64748B", sort_order: 4 },

  // Payment methods
  { type: "payment_method", name: "Cash", description: "Physical envelope or donation box", color: "#10B981", sort_order: 1 },
  { type: "payment_method", name: "GCash", description: "Philippine mobile wallet QR scan", color: "#007DFE", sort_order: 2 },
  { type: "payment_method", name: "Bank Transfer", description: "Direct BDO / BPI bank deposit", color: "#6366F1", sort_order: 3 },
  { type: "payment_method", name: "Online / Card", description: "Credit/Debit card payment", color: "#8B5CF6", sort_order: 4 }
];

// Default fallback settings
const DEFAULT_SETTINGS: Record<string, { value: string; category: string }> = {
  church_name: { value: "Daet Presbyterian Church", category: "general" },
  church_tagline: { value: "Knowing Christ and Making Him Known", category: "general" },
  contact_email: { value: "contact@daetpresbyterian.org", category: "general" },
  contact_phone: { value: "+63 (54) 440-1234", category: "general" },
  address: { value: "Vinzon Avenue, Daet, Camarines Norte", category: "general" },
  sunday_service_time: { value: "9:30 AM", category: "general" },
  currency_symbol: { value: "₱", category: "finance" },
  tax_exempt_id: { value: "TIN-009-876-543-000", category: "finance" }
};

// ----------------------------------------------------
// SYSTEM LOOKUPS (Categories, Locations, Payment Methods)
// ----------------------------------------------------

// List lookups (auto-populates defaults if table is empty)
router.get("/lookups", async (req: Request, res: Response) => {
  try {
    const { type, active_only } = req.query;

    let query = "SELECT * FROM system_lookups WHERE 1=1";
    const params: any[] = [];

    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }

    if (active_only === "true") {
      query += " AND is_active = 1";
    }

    query += " ORDER BY type ASC, sort_order ASC, name ASC";

    let list = await db.all(query, params);

    // Auto-seed defaults if table is completely empty
    if ((!list || list.length === 0) && !type) {
      for (const item of DEFAULT_LOOKUPS) {
        await db.run(`
          INSERT INTO system_lookups (type, name, description, color, sort_order, is_active)
          VALUES ($1, $2, $3, $4, $5, 1)
          ON CONFLICT (type, name) DO NOTHING
        `, [item.type, item.name, item.description, item.color, item.sort_order]);
      }
      list = await db.all(query, params);
    }

    res.json(list || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single lookup by ID
router.get("/lookups/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lookup = await db.get("SELECT * FROM system_lookups WHERE id = $1", [id]);
    if (!lookup) return res.status(404).json({ error: "Lookup not found" });
    res.json(lookup);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create lookup (Admin only)
router.post("/lookups", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { type, name, description, color = "#2C3968", sort_order = 0, is_active = 1 } = req.body;

    if (!type || !name) {
      return res.status(400).json({ error: "Lookup type and name are required" });
    }

    const existing = await db.get("SELECT id FROM system_lookups WHERE type = $1 AND LOWER(name) = LOWER($2)", [type.trim(), name.trim()]);
    if (existing) {
      return res.status(400).json({ error: `A lookup item with name '${name.trim()}' already exists in ${type}` });
    }

    const result = await db.run(`
      INSERT INTO system_lookups (type, name, description, color, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      type.trim(),
      name.trim(),
      description || null,
      color,
      Number(sort_order) || 0,
      is_active !== undefined ? (is_active ? 1 : 0) : 1
    ]);

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user?.id || null, "CREATE", "system_lookups", newId, `Created ${type}: ${name.trim()}`);

    res.status(201).json({ id: newId, message: "Lookup created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update lookup (Admin only)
router.put("/lookups/:id", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { name, description, color, sort_order, is_active } = req.body;

    const current = await db.get("SELECT * FROM system_lookups WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Lookup not found" });

    const updatedName = name !== undefined ? name.trim() : current.name;

    if (name && name.trim().toLowerCase() !== current.name.toLowerCase()) {
      const duplicate = await db.get("SELECT id FROM system_lookups WHERE type = $1 AND LOWER(name) = LOWER($2) AND id != $3", [current.type, name.trim(), id]);
      if (duplicate) return res.status(400).json({ error: `Another item in ${current.type} already has this name` });
    }

    await db.run(`
      UPDATE system_lookups
      SET name = $1,
          description = $2,
          color = $3,
          sort_order = $4,
          is_active = $5
      WHERE id = $6
    `, [
      updatedName,
      description !== undefined ? description : current.description,
      color !== undefined ? color : current.color,
      sort_order !== undefined ? Number(sort_order) : current.sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : current.is_active,
      id
    ]);

    await logAuditAction(req.user?.id || null, "UPDATE", "system_lookups", Number(id), `Updated ${current.type}: ${updatedName}`);
    res.json({ message: "Lookup updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete lookup (Admin only)
router.delete("/lookups/:id", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const current = await db.get("SELECT * FROM system_lookups WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Lookup not found" });

    await db.run("DELETE FROM system_lookups WHERE id = $1", [id]);
    await logAuditAction(req.user?.id || null, "DELETE", "system_lookups", Number(id), `Deleted ${current.type}: ${current.name}`);

    res.json({ message: "Lookup deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Restore default lookups (Admin only)
router.post("/lookups/reset", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    for (const item of DEFAULT_LOOKUPS) {
      await db.run(`
        INSERT INTO system_lookups (type, name, description, color, sort_order, is_active)
        VALUES ($1, $2, $3, $4, $5, 1)
        ON CONFLICT (type, name) DO UPDATE SET
          description = EXCLUDED.description,
          color = EXCLUDED.color,
          sort_order = EXCLUDED.sort_order,
          is_active = 1
      `, [item.type, item.name, item.description, item.color, item.sort_order]);
    }
    await logAuditAction(req.user?.id || null, "UPDATE", "system_lookups", null, "Reset system lookups to defaults");
    res.json({ message: "Default system lookups restored successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// GENERAL SYSTEM SETTINGS
// ----------------------------------------------------

// Get general settings (auto-populates defaults if empty)
router.get("/general", async (req: Request, res: Response) => {
  try {
    let list = await db.all("SELECT * FROM system_settings ORDER BY category ASC, key ASC");

    if (!list || list.length === 0) {
      for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
        await db.run(`
          INSERT INTO system_settings (key, value, category)
          VALUES ($1, $2, $3)
          ON CONFLICT (key) DO NOTHING
        `, [key, val.value, val.category]);
      }
      list = await db.all("SELECT * FROM system_settings ORDER BY category ASC, key ASC");
    }

    const settingsMap: Record<string, string> = {};
    (list || []).forEach(item => {
      settingsMap[item.key] = item.value;
    });

    res.json({ settings: settingsMap, list: list || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update general settings (Admin only)
router.put("/general", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const settingsData = req.body.settings || req.body;

    for (const [k, v] of Object.entries(settingsData)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        await db.run(`
          INSERT INTO system_settings (key, value, category, updated_at)
          VALUES ($1, $2, 'general', CURRENT_TIMESTAMP)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
        `, [k, String(v)]);
      }
    }

    await logAuditAction(req.user?.id || null, "UPDATE", "system_settings", null, "Updated system general settings");
    res.json({ message: "General settings saved successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset general settings to defaults (Admin only)
router.post("/general/reset", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      await db.run(`
        INSERT INTO system_settings (key, value, category, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
      `, [key, val.value, val.category]);
    }
    await logAuditAction(req.user?.id || null, "UPDATE", "system_settings", null, "Reset general settings to defaults");
    res.json({ message: "General settings reset to defaults successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SYSTEM DIAGNOSTICS & BACKEND HEALTH
// ----------------------------------------------------
router.get("/system-info", async (_req: Request, res: Response) => {
  try {
    const [usersCount, membersCount, eventsCount, attendanceCount, ministriesCount] = await Promise.all([
      db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM users"),
      db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM members"),
      db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM events"),
      db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM attendance"),
      db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM ministries")
    ]);

    res.json({
      database: "PostgreSQL",
      status: "connected",
      uptime_seconds: Math.floor(process.uptime()),
      node_version: process.version,
      stats: {
        users: Number(usersCount?.count || 0),
        members: Number(membersCount?.count || 0),
        events: Number(eventsCount?.count || 0),
        attendance: Number(attendanceCount?.count || 0),
        ministries: Number(ministriesCount?.count || 0)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, logAuditAction } from "../middleware/auth";
import { autoGenerateSundayServices, getServicesWithRecordedStatus } from "../utils/attendanceRules";
import { emitRealtimeEvent } from "../socket";

const router = Router();

// Helper to get default date range (past 12 weeks to future 12 weeks)
function getDefaultServiceRange(): { fromDate: string; toDate: string } {
  try {
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const [y, m, d] = todayStr.split("-").map(Number);
    const now = new Date(y, m - 1, d);
    const past84 = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);
    const future84 = new Date(now.getTime() + 84 * 24 * 60 * 60 * 1000);

    const from = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(past84);
    const to = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(future84);
    return { fromDate: from, toDate: to };
  } catch {
    const now = new Date();
    const from = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const to = new Date(now.getTime() + 84 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return { fromDate: from, toDate: to };
  }
}

// 1. GET /api/services — List service calendar items with recorded check-in counts
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!["Admin", "Coordinator"].includes(user.role_name)) {
      return res.status(403).json({ error: "Access denied. Requires Admin or Coordinator role." });
    }

    const defaultRange = getDefaultServiceRange();
    const fromDate = (typeof req.query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from))
      ? req.query.from
      : defaultRange.fromDate;
    const toDate = (typeof req.query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to))
      ? req.query.to
      : defaultRange.toDate;

    // Ensure upcoming Sundays are auto-generated
    await autoGenerateSundayServices(12, 12, user.id);

    const services = await getServicesWithRecordedStatus(fromDate, toDate);

    // Optional status or type filter
    let filtered = services;
    if (req.query.type && typeof req.query.type === "string") {
      filtered = filtered.filter((s) => s.service_type === req.query.type);
    }
    if (req.query.status && typeof req.query.status === "string") {
      filtered = filtered.filter((s) => s.status === req.query.status);
    }

    return res.json({
      services: filtered,
      total: filtered.length,
      from_date: fromDate,
      to_date: toDate
    });
  } catch (err: any) {
    console.error("Error in GET /api/services:", err);
    return res.status(500).json({ error: "Failed to fetch services", details: err?.message });
  }
});

// 2. POST /api/services — Add a new service (special service or specific date)
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !["Admin", "Coordinator"].includes(user.role_name)) {
      return res.status(403).json({ error: "Access denied. Requires Admin or Coordinator role." });
    }

    const { service_date, service_type = "sunday_service", title, status = "held", notes } = req.body;

    if (!service_date || !title) {
      return res.status(400).json({ error: "Service date and title are required." });
    }

    const result = await db.get(`
      INSERT INTO services (service_date, service_type, title, status, notes, created_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (service_date, service_type) DO UPDATE SET
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [service_date, service_type, title.trim(), status, notes || "", user.id]);

    await logAuditAction(
      user.id,
      "CREATE",
      "services",
      result?.id || null,
      `Created/Updated service: ${title} on ${service_date} (${status})`
    );

    emitRealtimeEvent("services:changed", { action: "create", id: result?.id, service_date });

    return res.status(201).json({ service: result });
  } catch (err: any) {
    console.error("Error in POST /api/services:", err);
    return res.status(500).json({ error: "Failed to create service", details: err?.message });
  }
});

// 3. PUT /api/services/:id — Update service status (held/cancelled), title, or notes
router.put("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !["Admin", "Coordinator"].includes(user.role_name)) {
      return res.status(403).json({ error: "Access denied. Requires Admin or Coordinator role." });
    }

    const { id } = req.params;
    const { title, status, notes } = req.body;

    const current = await db.get("SELECT * FROM services WHERE id = $1", [id]);
    if (!current) {
      return res.status(404).json({ error: "Service not found." });
    }

    const updated = await db.get(`
      UPDATE services
      SET
        title = COALESCE($1, title),
        status = COALESCE($2, status),
        notes = COALESCE($3, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [title !== undefined ? title.trim() : null, status || null, notes !== undefined ? notes : null, id]);

    await logAuditAction(
      user.id,
      "UPDATE",
      "services",
      Number(id),
      `Updated service #${id} (${updated.service_date}): status=${updated.status}`
    );

    emitRealtimeEvent("services:changed", { action: "update", id: Number(id), service_date: updated.service_date });

    return res.json({ service: updated });
  } catch (err: any) {
    console.error("Error in PUT /api/services/:id:", err);
    return res.status(500).json({ error: "Failed to update service", details: err?.message });
  }
});

// 4. POST /api/services/generate-sundays — Force auto-generation of upcoming Sundays
router.post("/generate-sundays", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || !["Admin", "Coordinator"].includes(user.role_name)) {
      return res.status(403).json({ error: "Access denied." });
    }

    const count = await autoGenerateSundayServices(12, 16, user.id);
    return res.json({ success: true, count, message: `Generated ${count} upcoming Sundays.` });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to generate services", details: err?.message });
  }
});

export default router;

import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";

const router = Router();

// List announcements
router.get("/announcements", async (req: Request, res: Response) => {
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
    const params: any[] = [];

    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND (a.ministry_id = $${params.length} OR a.ministry_id IS NULL)`;
    }

    query += " ORDER BY a.is_pinned DESC, a.created_at DESC";

    const announcements = await db.all(query, params);
    res.json(announcements);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create announcement
router.post("/announcements", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const { ministry_id, title, body, is_pinned = false } = req.body;

    if (!title || !title.trim() || !body || !body.trim()) {
      return res.status(400).json({ error: "Title and message body are required" });
    }

    // Coordinator can only post to their assigned ministry
    if (req.user!.role_name === "Coordinator") {
      if (!ministry_id || !req.user!.ministry_ids.includes(Number(ministry_id))) {
        return res.status(403).json({ error: "Coordinators can only post announcements for their assigned ministry" });
      }
    }

    const result = await db.run(`
      INSERT INTO announcements (ministry_id, author_id, title, body, is_pinned)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [ministry_id || null, req.user!.id, title, body, Boolean(is_pinned)]);

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user!.id, "CREATE", "announcements", newId, `Created announcement: ${title}`);
    emitRealtimeEvent("communications:changed", { action: "create_announcement", id: newId });

    res.status(201).json({ id: newId, message: "Announcement created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete announcement
router.delete("/announcements/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    await db.run("DELETE FROM announcements WHERE id = $1", [id]);
    await logAuditAction(req.user!.id, "DELETE", "announcements", Number(id), `Deleted announcement #${id}`);
    emitRealtimeEvent("communications:changed", { action: "delete_announcement", id: Number(id) });
    res.json({ message: "Announcement deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;


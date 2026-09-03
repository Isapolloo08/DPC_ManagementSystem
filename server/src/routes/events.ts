import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";

const router = Router();

// List events
router.get("/", async (req: Request, res: Response) => {
  try {
    const { ministry_id, upcoming } = req.query;

    let query = `
      SELECT e.*, 
             min.name as ministry_name, min.color as ministry_color,
             u.name as creator_name,
             (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND status = 'registered') as rsvp_count
      FROM events e
      LEFT JOIN ministries min ON e.ministry_id = min.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND (e.ministry_id = $${params.length} OR e.ministry_id IS NULL)`;
    }

    if (upcoming === "true") {
      query += " AND e.start_time >= CURRENT_TIMESTAMP";
    }

    query += " ORDER BY e.start_time ASC";

    const events = await db.all(query, params);
    const formatted = events.map(e => ({
      ...e,
      rsvp_count: Number(e.rsvp_count || 0)
    }));
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single event details with registrations
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const event = await db.get(`
      SELECT e.*, min.name as ministry_name, min.color as ministry_color, u.name as creator_name
      FROM events e
      LEFT JOIN ministries min ON e.ministry_id = min.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = $1
    `, [req.params.id]);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const registrations = await db.all(`
      SELECT er.*, m.first_name, m.last_name, m.contact_email, m.contact_phone
      FROM event_registrations er
      JOIN members m ON er.member_id = m.id
      WHERE er.event_id = $1
      ORDER BY er.created_at DESC
    `, [event.id]);

    res.json({
      ...event,
      registrations
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create event
router.post("/", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const { ministry_id, title, description, start_time, end_time, location } = req.body;

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: "Title, start time, and end time are required" });
    }

    const result = await db.run(`
      INSERT INTO events (ministry_id, title, description, start_time, end_time, location, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      ministry_id || null,
      title,
      description || null,
      start_time,
      end_time,
      location || null,
      req.user!.id
    ]);

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user!.id, "CREATE", "events", newId, `Created event: ${title}`);

    res.status(201).json({ id: newId, message: "Event created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// RSVP / Register for event
router.post("/:id/rsvp", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const eventId = req.params.id;
    const { member_id, status = "registered" } = req.body;

    // If member_id isn't provided, try to find linked member from current user
    let targetMemberId = member_id;
    if (!targetMemberId) {
      const linkedMember = await db.get("SELECT id FROM members WHERE user_id = $1", [req.user!.id]);
      if (linkedMember) {
        targetMemberId = linkedMember.id;
      } else {
        return res.status(400).json({ error: "member_id is required" });
      }
    }

    const existing = await db.get(`
      SELECT * FROM event_registrations WHERE event_id = $1 AND member_id = $2
    `, [eventId, targetMemberId]);

    if (existing) {
      await db.run(`
        UPDATE event_registrations SET status = $1 WHERE id = $2
      `, [status, existing.id]);
      return res.json({ message: "RSVP updated", status });
    }

    await db.run(`
      INSERT INTO event_registrations (event_id, member_id, status)
      VALUES ($1, $2, $3)
    `, [eventId, targetMemberId, status]);

    res.status(201).json({ message: "RSVP confirmed successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete event
router.delete("/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    await db.run("DELETE FROM events WHERE id = $1", [id]);
    await logAuditAction(req.user!.id, "DELETE", "events", Number(id), `Deleted event #${id}`);
    res.json({ message: "Event deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";

const router = Router();

// Get study topics with stats summary
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, type, ministry_id, search } = req.query;

    let query = `
      SELECT t.*, 
             g.name as group_name, min.name as ministry_name, min.color as ministry_color
      FROM bible_study_topics t
      LEFT JOIN bible_study_groups g ON t.assigned_group_id = g.id
      LEFT JOIN ministries min ON t.assigned_ministry_id = min.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== "all") {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    if (type && type !== "all") {
      params.push(type);
      query += ` AND t.type = $${params.length}`;
    }

    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND t.assigned_ministry_id = $${params.length}`;
    }

    if (search && typeof search === "string") {
      params.push(`%${search}%`);
      const pIdx = params.length;
      query += ` AND (t.title ILIKE $${pIdx} OR t.lead_teacher ILIKE $${pIdx} OR t.key_verse ILIKE $${pIdx} OR t.testament_or_category ILIKE $${pIdx})`;
    }

    query += " ORDER BY t.status ASC, t.id ASC";

    const topics = await db.all(query, params);

    // Summary counts
    const allTopics = await db.all("SELECT * FROM bible_study_topics");
    const counts = {
      total: allTopics.length,
      completed: allTopics.filter(t => t.status === "completed").length,
      in_progress: allTopics.filter(t => t.status === "in_progress").length,
      planned: allTopics.filter(t => t.status === "planned").length,
      books_completed: allTopics.filter(t => t.type === "book" && t.status === "completed").length,
      total_chapters_completed: allTopics.reduce((acc, t) => acc + (Number(t.completed_chapters) || 0), 0)
    };

    res.json({
      topics,
      summary: counts
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create study topic
router.post("/", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      type = "book",
      testament_or_category,
      total_chapters = 1,
      completed_chapters = 0,
      status = "in_progress",
      completed_date,
      assigned_group_id,
      assigned_ministry_id,
      lead_teacher,
      key_verse,
      summary_notes
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Topic title is required" });
    }

    const result = await db.run(`
      INSERT INTO bible_study_topics (
        title, type, testament_or_category, total_chapters, completed_chapters,
        status, completed_date, assigned_group_id, assigned_ministry_id,
        lead_teacher, key_verse, summary_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      title.trim(),
      type,
      testament_or_category || null,
      Number(total_chapters) || 1,
      Number(completed_chapters) || 0,
      status,
      status === "completed" ? (completed_date || new Date().toISOString().split("T")[0]) : null,
      assigned_group_id ? Number(assigned_group_id) : null,
      assigned_ministry_id ? Number(assigned_ministry_id) : null,
      lead_teacher || null,
      key_verse || null,
      summary_notes || null
    ]);

    const newId = result.lastInsertRowid;
    await logAuditAction(req.user?.id || null, "CREATE", "bible_study_topics", newId, `Created study topic: ${title}`);

    res.status(201).json({ id: newId, message: "Study topic created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update study topic
router.put("/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const {
      title,
      type,
      testament_or_category,
      total_chapters,
      completed_chapters,
      status,
      completed_date,
      assigned_group_id,
      assigned_ministry_id,
      lead_teacher,
      key_verse,
      summary_notes
    } = req.body;

    await db.run(`
      UPDATE bible_study_topics
      SET title = COALESCE($1, title),
          type = COALESCE($2, type),
          testament_or_category = COALESCE($3, testament_or_category),
          total_chapters = COALESCE($4, total_chapters),
          completed_chapters = COALESCE($5, completed_chapters),
          status = COALESCE($6, status),
          completed_date = COALESCE($7, completed_date),
          assigned_group_id = COALESCE($8, assigned_group_id),
          assigned_ministry_id = COALESCE($9, assigned_ministry_id),
          lead_teacher = COALESCE($10, lead_teacher),
          key_verse = COALESCE($11, key_verse),
          summary_notes = COALESCE($12, summary_notes)
      WHERE id = $13
    `, [
      title !== undefined ? title.trim() : null,
      type,
      testament_or_category,
      total_chapters !== undefined ? Number(total_chapters) : null,
      completed_chapters !== undefined ? Number(completed_chapters) : null,
      status,
      completed_date,
      assigned_group_id !== undefined ? (assigned_group_id ? Number(assigned_group_id) : null) : null,
      assigned_ministry_id !== undefined ? (assigned_ministry_id ? Number(assigned_ministry_id) : null) : null,
      lead_teacher,
      key_verse,
      summary_notes,
      id
    ]);

    await logAuditAction(req.user?.id || null, "UPDATE", "bible_study_topics", Number(id), `Updated study topic #${id}`);
    res.json({ message: "Study topic updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle completed status
router.post("/:id/toggle-completed", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const current = await db.get("SELECT * FROM bible_study_topics WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Study topic not found" });

    const isNowCompleted = current.status !== "completed";
    const nextStatus = isNowCompleted ? "completed" : "in_progress";
    const nextDate = isNowCompleted ? new Date().toISOString().split("T")[0] : null;
    const nextChapters = isNowCompleted ? current.total_chapters : current.completed_chapters;

    await db.run(`
      UPDATE bible_study_topics
      SET status = $1, completed_date = $2, completed_chapters = $3
      WHERE id = $4
    `, [nextStatus, nextDate, nextChapters, id]);

    await logAuditAction(req.user?.id || null, "UPDATE", "bible_study_topics", Number(id), `Marked topic '${current.title}' as ${nextStatus}`);

    res.json({
      message: `Topic marked as ${nextStatus}`,
      status: nextStatus,
      completed_date: nextDate
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete study topic
router.delete("/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    await db.run("DELETE FROM bible_study_topics WHERE id = $1", [id]);
    await logAuditAction(req.user?.id || null, "DELETE", "bible_study_topics", Number(id), `Deleted study topic #${id}`);
    res.json({ message: "Study topic deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

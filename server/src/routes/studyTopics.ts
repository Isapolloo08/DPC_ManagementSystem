import express from "express";
import { db } from "../db/schema";
import { authMiddleware, requireRoles } from "../middleware/auth";

const router = express.Router();
router.use(authMiddleware);

// ====================================================
// 1. GET ALL STUDY TOPICS & CURRICULUM SUMMARY
// ====================================================
router.get("/", async (req, res) => {
  try {
    const { status, type, ministry_id, search } = req.query;

    let sql = `
      SELECT 
        t.*,
        g.name as group_name,
        g.leader_name as leader_name,
        g.leader_contact as leader_phone,
        g.meeting_day,
        g.meeting_time,
        g.location as current_location,
        COALESCE(m.name, gm.name) as ministry_name,
        COALESCE(m.color, gm.color) as ministry_color
      FROM bible_study_topics t
      LEFT JOIN bible_study_groups g ON t.assigned_group_id = g.id
      LEFT JOIN ministries m ON t.assigned_ministry_id = m.id
      LEFT JOIN ministries gm ON g.ministry_id = gm.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== "all") {
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      sql += ` AND t.type = $${params.length}`;
    }

    if (ministry_id) {
      params.push(Number(ministry_id));
      sql += ` AND (t.assigned_ministry_id = $${params.length} OR g.ministry_id = $${params.length})`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (t.title ILIKE $${params.length} OR t.testament_or_category ILIKE $${params.length} OR t.lead_teacher ILIKE $${params.length} OR t.key_verse ILIKE $${params.length})`;
    }

    sql += ` ORDER BY CASE WHEN t.status = 'in_progress' THEN 1 WHEN t.status = 'completed' THEN 2 ELSE 3 END, t.created_at DESC`;

    const topics = await db.all<any>(sql, params);

    // Compute Summary Stats
    const allTopics = await db.all<any>("SELECT * FROM bible_study_topics");
    const total_count = allTopics.length;
    const completed_count = allTopics.filter(t => t.status === "completed").length;
    const in_progress_count = allTopics.filter(t => t.status === "in_progress").length;
    const planned_count = allTopics.filter(t => t.status === "planned").length;
    const completion_rate = total_count > 0 ? Math.round((completed_count / total_count) * 100) : 0;
    const completed_books = allTopics.filter(t => t.status === "completed");

    res.json({
      topics,
      total_count,
      completed_count,
      in_progress_count,
      planned_count,
      completion_rate,
      completed_books
    });
  } catch (error: any) {
    console.error("Failed to fetch study topics:", error);
    res.status(500).json({ error: error.message || "Failed to fetch study topics" });
  }
});

// ====================================================
// 2. GET SINGLE STUDY TOPIC WITH GROUP & MEMBERS DETAILS
// ====================================================
router.get("/:id", async (req, res) => {
  try {
    const topicId = Number(req.params.id);

    const topic = await db.get<any>(`
      SELECT 
        t.*,
        g.name as group_name,
        g.leader_name as leader_name,
        g.leader_contact as leader_phone,
        g.meeting_day,
        g.meeting_time,
        g.location as current_location,
        COALESCE(m.name, gm.name) as ministry_name,
        COALESCE(m.color, gm.color) as ministry_color
      FROM bible_study_topics t
      LEFT JOIN bible_study_groups g ON t.assigned_group_id = g.id
      LEFT JOIN ministries m ON t.assigned_ministry_id = m.id
      LEFT JOIN ministries gm ON g.ministry_id = gm.id
      WHERE t.id = $1
    `, [topicId]);

    if (!topic) {
      return res.status(404).json({ error: "Study topic not found" });
    }

    // Fetch enrolled group members if assigned to a group
    let group_members: any[] = [];
    if (topic.assigned_group_id) {
      group_members = await db.all<any>(`
        SELECT 
          bm.id as enrollment_id,
          bm.group_id,
          bm.member_id,
          bm.joined_at,
          m.first_name,
          m.last_name,
          m.contact_phone,
          m.contact_email,
          m.gender,
          m.status as member_status,
          min.name as member_ministry_name
        FROM bible_study_members bm
        JOIN members m ON bm.member_id = m.id
        LEFT JOIN ministries min ON m.ministry_id = min.id
        WHERE bm.group_id = $1
        ORDER BY m.first_name ASC, m.last_name ASC
      `, [topic.assigned_group_id]);
    }

    // Fetch all groups to cross-match curriculum progress
    const all_groups = await db.all<any>(`
      SELECT 
        id, name, leader_name, leader_contact, meeting_day, meeting_time, 
        location, category, curriculum, current_chapter, progress_stage, ministry_id
      FROM bible_study_groups
      ORDER BY name ASC
    `);

    res.json({
      topic,
      group_members,
      all_groups
    });
  } catch (error: any) {
    console.error("Failed to fetch study topic details:", error);
    res.status(500).json({ error: error.message || "Failed to fetch study topic details" });
  }
});

// ====================================================
// 3. CREATE STUDY TOPIC
// ====================================================
router.post("/", requireRoles("Admin", "Coordinator", "Leader"), async (req, res) => {
  try {
    const {
      title,
      type = "book",
      testament_or_category = "New Testament",
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
      return res.status(400).json({ error: "Title is required" });
    }

    const result = await db.run(`
      INSERT INTO bible_study_topics (
        title, type, testament_or_category, total_chapters, completed_chapters,
        status, completed_date, assigned_group_id, assigned_ministry_id,
        lead_teacher, key_verse, summary_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      title,
      type,
      testament_or_category,
      Number(total_chapters) || 1,
      Number(completed_chapters) || 0,
      status,
      completed_date || null,
      assigned_group_id ? Number(assigned_group_id) : null,
      assigned_ministry_id ? Number(assigned_ministry_id) : null,
      lead_teacher || null,
      key_verse || null,
      summary_notes || null
    ]);

    res.status(201).json({
      id: result.lastInsertRowid || (result as any).id,
      message: "Study topic added successfully"
    });
  } catch (error: any) {
    console.error("Failed to create study topic:", error);
    res.status(500).json({ error: error.message || "Failed to create study topic" });
  }
});

// ====================================================
// 4. UPDATE STUDY TOPIC
// ====================================================
router.put("/:id", requireRoles("Admin", "Coordinator", "Leader"), async (req, res) => {
  try {
    const topicId = Number(req.params.id);
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

    const existing = await db.get("SELECT id FROM bible_study_topics WHERE id = $1", [topicId]);
    if (!existing) {
      return res.status(404).json({ error: "Study topic not found" });
    }

    await db.run(`
      UPDATE bible_study_topics
      SET 
        title = COALESCE($1, title),
        type = COALESCE($2, type),
        testament_or_category = COALESCE($3, testament_or_category),
        total_chapters = COALESCE($4, total_chapters),
        completed_chapters = COALESCE($5, completed_chapters),
        status = COALESCE($6, status),
        completed_date = $7,
        assigned_group_id = $8,
        assigned_ministry_id = $9,
        lead_teacher = COALESCE($10, lead_teacher),
        key_verse = COALESCE($11, key_verse),
        summary_notes = COALESCE($12, summary_notes)
      WHERE id = $13
    `, [
      title,
      type,
      testament_or_category,
      total_chapters !== undefined ? Number(total_chapters) : null,
      completed_chapters !== undefined ? Number(completed_chapters) : null,
      status,
      completed_date,
      assigned_group_id ? Number(assigned_group_id) : null,
      assigned_ministry_id ? Number(assigned_ministry_id) : null,
      lead_teacher,
      key_verse,
      summary_notes,
      topicId
    ]);

    res.json({ message: "Study topic updated successfully" });
  } catch (error: any) {
    console.error("Failed to update study topic:", error);
    res.status(500).json({ error: error.message || "Failed to update study topic" });
  }
});

// ====================================================
// 5. DELETE STUDY TOPIC
// ====================================================
router.delete("/:id", requireRoles("Admin", "Coordinator", "Leader"), async (req, res) => {
  try {
    const topicId = Number(req.params.id);
    await db.run("DELETE FROM bible_study_topics WHERE id = $1", [topicId]);
    res.json({ message: "Study topic deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete study topic:", error);
    res.status(500).json({ error: error.message || "Failed to delete study topic" });
  }
});

export default router;

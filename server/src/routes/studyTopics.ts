import express from "express";
import { db } from "../db/schema";
import { authMiddleware, requireRoles } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";

const router = express.Router();
router.use(authMiddleware);

export const BIBLE_BOOKS_MAP: Record<string, number> = {
  // Old Testament
  "genesis": 50, "exodus": 40, "leviticus": 27, "numbers": 36, "deuteronomy": 34,
  "joshua": 24, "judges": 21, "ruth": 4, "1 samuel": 31, "2 samuel": 24,
  "1 kings": 22, "2 kings": 25, "1 chronicles": 29, "2 chronicles": 36,
  "ezra": 10, "nehemiah": 13, "esther": 10, "job": 42, "psalms": 150, "psalm": 150,
  "proverbs": 31, "ecclesiastes": 12, "song of solomon": 8, "song of songs": 8,
  "isaiah": 66, "jeremiah": 52, "lamentations": 5, "ezekiel": 48, "daniel": 12,
  "hosea": 14, "joel": 3, "amos": 9, "obadiah": 1, "jonah": 4, "micah": 7,
  "nahum": 3, "habakkuk": 3, "zephaniah": 3, "haggai": 2, "zechariah": 14, "malachi": 4,
  // New Testament
  "matthew": 28, "gospel of matthew": 28,
  "mark": 16, "gospel of mark": 16,
  "luke": 24, "gospel of luke": 24,
  "john": 21, "gospel of john": 21,
  "acts": 28, "acts of the apostles": 28,
  "romans": 16, "book of romans": 16,
  "1 corinthians": 16, "2 corinthians": 13, "galatians": 6, "ephesians": 6,
  "philippians": 4, "colossians": 4, "1 thessalonians": 5, "2 thessalonians": 3,
  "1 timothy": 6, "2 timothy": 4, "titus": 3, "philemon": 1,
  "hebrews": 13, "james": 5, "1 peter": 5, "2 peter": 3,
  "1 john": 5, "2 john": 1, "3 john": 1, "jude": 1,
  "revelation": 22
};

export function resolveTotalChapters(title: string, dbTopics: { title: string; total_chapters: number }[] = []): number {
  if (!title || !title.trim()) return 12;
  const clean = title.trim().toLowerCase();

  // 1. Direct match in database topics
  const dbMatch = dbTopics.find(t => t.title.toLowerCase().trim() === clean || clean.includes(t.title.toLowerCase().trim()));
  if (dbMatch && dbMatch.total_chapters > 0) {
    return Number(dbMatch.total_chapters);
  }

  // 2. Direct match in standard Bible books map
  if (BIBLE_BOOKS_MAP[clean]) {
    return BIBLE_BOOKS_MAP[clean];
  }

  // 3. Partial match in Bible books map
  for (const [bookKey, chapters] of Object.entries(BIBLE_BOOKS_MAP)) {
    if (clean.includes(bookKey) || bookKey.includes(clean)) {
      return chapters;
    }
  }

  return 12; // Standard default
}

// ====================================================
// 1. GET ALL STUDY TOPICS & CURRICULUM SUMMARY
// ====================================================
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT 
        t.id,
        t.title,
        t.total_chapters,
        t.summary_notes,
        t.created_at
      FROM bible_study_topics t
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === "string" && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (t.title ILIKE $${params.length} OR t.summary_notes ILIKE $${params.length})`;
    }

    sql += ` ORDER BY t.created_at DESC`;

    const topics = await db.all<any>(sql, params);
    const total_count = topics.length;

    res.json({
      topics,
      total_count,
      bible_books_map: BIBLE_BOOKS_MAP
    });
  } catch (error: any) {
    console.error("Failed to fetch study topics:", error);
    res.status(500).json({ error: error.message || "Failed to fetch study topics" });
  }
});

// ====================================================
// 1.1 RESOLVE CHAPTERS FOR A GIVEN BOOK TITLE
// ====================================================
router.get("/resolve-chapters", async (req, res) => {
  try {
    const title = String(req.query.title || "");
    const dbTopics = await db.all<{ title: string; total_chapters: number }>("SELECT title, total_chapters FROM bible_study_topics");
    const total_chapters = resolveTotalChapters(title, dbTopics);

    const chapter_list = Array.from({ length: total_chapters }, (_, i) => `Chapter ${i + 1}`);

    res.json({
      title,
      total_chapters,
      chapter_list
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ====================================================
// 2. GET SINGLE STUDY TOPIC WITH GROUP DETAILS
// ====================================================
router.get("/:id", async (req, res) => {
  try {
    const topicId = Number(req.params.id);

    const topic = await db.get<any>(`
      SELECT 
        t.id,
        t.title,
        t.total_chapters,
        t.summary_notes,
        t.created_at
      FROM bible_study_topics t
      WHERE t.id = $1
    `, [topicId]);

    if (!topic) {
      return res.status(404).json({ error: "Study topic not found" });
    }

    // Fetch all groups to cross-match curriculum progress
    const all_groups = await db.all<any>(`
      SELECT 
        g.id, g.name, g.leader_name, g.leader_contact, g.meeting_day, g.meeting_time, 
        g.location, g.category, g.curriculum, g.current_chapter, g.progress_stage, g.ministry_id,
        m.name as ministry_name, m.color as ministry_color,
        (SELECT COUNT(*) FROM bible_study_members WHERE group_id = g.id) as current_member_count
      FROM bible_study_groups g
      LEFT JOIN ministries m ON g.ministry_id = m.id
      ORDER BY g.name ASC
    `);

    res.json({
      topic,
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
      total_chapters = 1,
      summary_notes
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const result = await db.run(`
      INSERT INTO bible_study_topics (
        title, total_chapters, summary_notes
      ) VALUES ($1, $2, $3)
      RETURNING id
    `, [
      title.trim(),
      Number(total_chapters) || 1,
      summary_notes ? summary_notes.trim() : null
    ]);

    const newId = result.lastInsertRowid || (result as any).id;
    emitRealtimeEvent("study_topics:changed", { action: "create", id: newId });

    res.status(201).json({
      id: newId,
      message: "Study book added successfully"
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
      total_chapters,
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
        total_chapters = COALESCE($2, total_chapters),
        summary_notes = COALESCE($3, summary_notes)
      WHERE id = $4
    `, [
      title ? title.trim() : null,
      total_chapters !== undefined ? Number(total_chapters) : null,
      summary_notes !== undefined ? (summary_notes ? summary_notes.trim() : null) : null,
      topicId
    ]);

    emitRealtimeEvent("study_topics:changed", { action: "update", id: topicId });

    res.json({ message: "Study book updated successfully" });
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

    emitRealtimeEvent("study_topics:changed", { action: "delete", id: topicId });

    res.json({ message: "Study book deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete study topic:", error);
    res.status(500).json({ error: error.message || "Failed to delete study topic" });
  }
});

export default router;

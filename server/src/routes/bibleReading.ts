import { Router, Response } from "express";
import { db, sql } from "../db/schema";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { emitRealtimeEvent } from "../socket";

const router = Router();

/**
 * GET /api/bible-reading/progress
 * Retrieves the logged-in user's completed reading day keys and stats
 */
router.get("/progress", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User authentication required" });
    }

    const rows = await db.all<{
      id: number;
      day_key: string;
      completed_at: string;
      notes: string | null;
    }>(
      `SELECT id, day_key, completed_at, notes
       FROM user_bible_reading_progress
       WHERE user_id = $1
       ORDER BY completed_at ASC`,
      [userId]
    );

    const completedKeys = rows.map(r => r.day_key);

    return res.json({
      success: true,
      completedKeys,
      records: rows
    });
  } catch (error: any) {
    console.error("Failed to fetch bible reading progress:", error);
    return res.status(500).json({ error: "Failed to fetch bible reading progress" });
  }
});

/**
 * POST /api/bible-reading/toggle
 * Toggle completion of a specific day for the current user
 */
router.post("/toggle", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User authentication required" });
    }

    const { day_key, notes } = req.body;
    if (!day_key || typeof day_key !== "string") {
      return res.status(400).json({ error: "day_key is required" });
    }

    // Check if already completed
    const existing = await db.get<{ id: number }>(
      `SELECT id FROM user_bible_reading_progress WHERE user_id = $1 AND day_key = $2`,
      [userId, day_key]
    );

    let isCompleted = false;

    if (existing) {
      // Remove completion (uncheck)
      await sql`DELETE FROM user_bible_reading_progress WHERE id = ${existing.id}`;
      isCompleted = false;
    } else {
      // Add completion
      await sql`
        INSERT INTO user_bible_reading_progress (user_id, day_key, notes)
        VALUES (${userId}, ${day_key}, ${notes || null})
        ON CONFLICT (user_id, day_key) DO NOTHING
      `;
      isCompleted = true;
    }

    // Emit real-time update
    emitRealtimeEvent("biblereading:changed", {
      userId,
      day_key,
      isCompleted
    });

    return res.json({
      success: true,
      day_key,
      isCompleted
    });
  } catch (error: any) {
    console.error("Failed to toggle bible reading day:", error);
    return res.status(500).json({ error: "Failed to toggle bible reading day" });
  }
});

/**
 * POST /api/bible-reading/mark-batch
 * Mark multiple days as completed or uncompleted
 */
router.post("/mark-batch", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User authentication required" });
    }

    const { day_keys, completed = true } = req.body;
    if (!Array.isArray(day_keys) || day_keys.length === 0) {
      return res.status(400).json({ error: "day_keys must be a non-empty array" });
    }

    if (completed) {
      for (const key of day_keys) {
        if (typeof key === "string" && key.trim()) {
          await sql`
            INSERT INTO user_bible_reading_progress (user_id, day_key)
            VALUES (${userId}, ${key.trim()})
            ON CONFLICT (user_id, day_key) DO NOTHING
          `;
        }
      }
    } else {
      await sql`
        DELETE FROM user_bible_reading_progress
        WHERE user_id = ${userId} AND day_key = ANY(${day_keys})
      `;
    }

    emitRealtimeEvent("biblereading:changed", { userId, batchUpdated: true });

    return res.json({
      success: true,
      count: day_keys.length,
      completed
    });
  } catch (error: any) {
    console.error("Failed to batch update bible reading days:", error);
    return res.status(500).json({ error: "Failed to batch update bible reading days" });
  }
});

/**
 * GET /api/bible-reading/stats
 * Overview stats across the church
 */
router.get("/stats", authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const totalCompletions = await db.get<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM user_bible_reading_progress`
    );
    const activeReaders = await db.get<{ count: string | number }>(
      `SELECT COUNT(DISTINCT user_id) as count FROM user_bible_reading_progress`
    );

    return res.json({
      success: true,
      totalCompletionsCount: Number(totalCompletions?.count || 0),
      activeReadersCount: Number(activeReaders?.count || 0)
    });
  } catch (error: any) {
    console.error("Failed to fetch bible reading stats:", error);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;

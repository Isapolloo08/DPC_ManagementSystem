import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";

const router = Router();

// List Bible study groups with members
router.get("/", async (req: Request, res: Response) => {
  try {
    const { ministry_id, category, meeting_day, search } = req.query;

    let query = `
      SELECT g.*, min.name as ministry_name, min.color as ministry_color,
             (SELECT COUNT(*) FROM bible_study_members WHERE group_id = g.id) as current_member_count
      FROM bible_study_groups g
      LEFT JOIN ministries min ON g.ministry_id = min.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (ministry_id) {
      params.push(ministry_id);
      query += ` AND g.ministry_id = $${params.length}`;
    }

    if (category) {
      params.push(category);
      query += ` AND g.category = $${params.length}`;
    }

    if (meeting_day) {
      params.push(meeting_day);
      query += ` AND g.meeting_day = $${params.length}`;
    }

    if (search && typeof search === "string") {
      params.push(`%${search}%`);
      const pIdx = params.length;
      query += ` AND (g.name ILIKE $${pIdx} OR g.leader_name ILIKE $${pIdx} OR g.curriculum ILIKE $${pIdx} OR g.location ILIKE $${pIdx})`;
    }

    query += " ORDER BY g.id ASC";

    const groups = await db.all(query, params);

    const detailed = await Promise.all(groups.map(async (g) => {
      const members = await db.all(`
        SELECT bsm.*, m.first_name, m.last_name, m.contact_email, m.contact_phone
        FROM bible_study_members bsm
        LEFT JOIN members m ON bsm.member_id = m.id
        WHERE bsm.group_id = $1
        ORDER BY bsm.joined_at ASC
      `, [g.id]);

      return {
        ...g,
        current_member_count: Number(g.current_member_count || 0),
        members: members.map(m => ({
          ...m,
          display_name: m.first_name ? `${m.first_name} ${m.last_name}` : m.member_name
        }))
      };
    }));

    res.json(detailed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific group
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const group = await db.get(`
      SELECT g.*, min.name as ministry_name, min.color as ministry_color
      FROM bible_study_groups g
      LEFT JOIN ministries min ON g.ministry_id = min.id
      WHERE g.id = $1
    `, [req.params.id]);

    if (!group) {
      return res.status(404).json({ error: "Small group not found" });
    }

    const members = await db.all(`
      SELECT bsm.*, m.first_name, m.last_name, m.contact_email, m.contact_phone
      FROM bible_study_members bsm
      LEFT JOIN members m ON bsm.member_id = m.id
      WHERE bsm.group_id = $1
      ORDER BY bsm.joined_at ASC
    `, [group.id]);

    res.json({
      ...group,
      members: members.map(m => ({
        ...m,
        display_name: m.first_name ? `${m.first_name} ${m.last_name}` : m.member_name
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create group (Admin / Coordinator)
router.post("/", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      description,
      curriculum,
      ministry_id,
      leader_name,
      leader_contact,
      meeting_day,
      meeting_time,
      location,
      category = "General",
      max_capacity = 12,
      member_ids = [],
      current_chapter = "Chapter 1",
      progress_stage = "in_progress",
      progress_notes = null
    } = req.body;

    if (!name || !leader_name || !meeting_day || !meeting_time || !location) {
      return res.status(400).json({ error: "Group name, leader name, day, time, and location are required" });
    }

    const result = await db.run(`
      INSERT INTO bible_study_groups (
        name, description, curriculum, ministry_id, leader_name, leader_contact,
        meeting_day, meeting_time, location, category, max_capacity,
        current_chapter, progress_stage, progress_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      name.trim(),
      description || null,
      curriculum || null,
      ministry_id ? Number(ministry_id) : null,
      leader_name.trim(),
      leader_contact || null,
      meeting_day,
      meeting_time,
      location,
      category,
      Number(max_capacity) || 12,
      current_chapter || 'Chapter 1',
      progress_stage || 'in_progress',
      progress_notes || null
    ]);

    const newId = result.lastInsertRowid;

    // Enroll initial selected members if provided
    if (Array.isArray(member_ids) && member_ids.length > 0) {
      for (const mId of member_ids) {
        const member = await db.get("SELECT first_name, last_name FROM members WHERE id = $1", [mId]);
        const mName = member ? `${member.first_name} ${member.last_name}` : "Member";
        await db.run(`
          INSERT INTO bible_study_members (group_id, member_id, member_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (group_id, member_id) DO NOTHING
        `, [newId, mId, mName]);
      }
    }

    await logAuditAction(req.user?.id || null, "CREATE", "bible_study_groups", newId, `Created Bible study group: ${name}`);

    res.status(201).json({ id: newId, message: "Small group created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update group
router.put("/:id", authMiddleware, requireRoles("Admin", "Coordinator", "Leader"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const {
      name,
      description,
      curriculum,
      ministry_id,
      leader_name,
      leader_contact,
      meeting_day,
      meeting_time,
      location,
      category,
      max_capacity,
      member_ids,
      current_chapter,
      progress_stage,
      progress_notes
    } = req.body;

    const current = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Small group not found" });

    await db.run(`
      UPDATE bible_study_groups
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          curriculum = COALESCE($3, curriculum),
          ministry_id = COALESCE($4, ministry_id),
          leader_name = COALESCE($5, leader_name),
          leader_contact = COALESCE($6, leader_contact),
          meeting_day = COALESCE($7, meeting_day),
          meeting_time = COALESCE($8, meeting_time),
          location = COALESCE($9, location),
          category = COALESCE($10, category),
          max_capacity = COALESCE($11, max_capacity),
          current_chapter = COALESCE($12, current_chapter),
          progress_stage = COALESCE($13, progress_stage),
          progress_notes = COALESCE($14, progress_notes)
      WHERE id = $15
    `, [
      name !== undefined ? name.trim() : null,
      description,
      curriculum,
      ministry_id !== undefined ? (ministry_id ? Number(ministry_id) : null) : null,
      leader_name !== undefined ? leader_name.trim() : null,
      leader_contact,
      meeting_day,
      meeting_time,
      location,
      category,
      max_capacity !== undefined ? Number(max_capacity) : null,
      current_chapter,
      progress_stage,
      progress_notes,
      id
    ]);

    // Update members if member_ids is passed
    if (Array.isArray(member_ids)) {
      await db.run("DELETE FROM bible_study_members WHERE group_id = $1", [id]);
      for (const mId of member_ids) {
        const member = await db.get("SELECT first_name, last_name FROM members WHERE id = $1", [mId]);
        const mName = member ? `${member.first_name} ${member.last_name}` : "Member";
        await db.run(`
          INSERT INTO bible_study_members (group_id, member_id, member_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (group_id, member_id) DO NOTHING
        `, [id, mId, mName]);
      }
    }

    await logAuditAction(req.user?.id || null, "UPDATE", "bible_study_groups", Number(id), `Updated small group: ${name || current.name}`);
    res.json({ message: "Small group updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dedicated Fast Endpoint: Update Study Chapter Progress & Notice
router.patch("/:id/progress", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { current_chapter, progress_stage, progress_notes } = req.body;

    const current = await db.get("SELECT * FROM bible_study_groups WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "Small group not found" });

    await db.run(`
      UPDATE bible_study_groups
      SET current_chapter = COALESCE($1, current_chapter),
          progress_stage = COALESCE($2, progress_stage),
          progress_notes = $3
      WHERE id = $4
    `, [
      current_chapter ? current_chapter.trim() : current.current_chapter,
      progress_stage || current.progress_stage || 'in_progress',
      progress_notes !== undefined ? progress_notes : current.progress_notes,
      id
    ]);

    await logAuditAction(
      req.user?.id || null,
      "UPDATE_PROGRESS",
      "bible_study_groups",
      Number(id),
      `Updated chapter progress for ${current.name}: ${current_chapter || current.current_chapter}`
    );

    res.json({ message: "Study chapter progress updated successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete group
router.delete("/:id", authMiddleware, requireRoles("Admin", "Coordinator"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    await db.run("DELETE FROM bible_study_members WHERE group_id = $1", [id]);
    await db.run("DELETE FROM bible_study_groups WHERE id = $1", [id]);

    await logAuditAction(req.user?.id || null, "DELETE", "bible_study_groups", Number(id), `Deleted small group #${id}`);
    res.json({ message: "Small group deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Join group
router.post("/:id/join", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const groupId = req.params.id;
    const { member_id, member_name } = req.body;

    let targetMemberId = member_id;
    let targetName = member_name;

    if (!targetMemberId && req.user) {
      const linkedMember = await db.get("SELECT * FROM members WHERE user_id = $1", [req.user.id]);
      if (linkedMember) {
        targetMemberId = linkedMember.id;
        targetName = `${linkedMember.first_name} ${linkedMember.last_name}`;
      } else {
        targetName = req.user.name;
      }
    }

    if (targetMemberId) {
      const existing = await db.get("SELECT * FROM bible_study_members WHERE group_id = $1 AND member_id = $2", [groupId, targetMemberId]);
      if (existing) {
        return res.status(400).json({ error: "You are already a member of this small group." });
      }
    }

    await db.run(`
      INSERT INTO bible_study_members (group_id, member_id, member_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (group_id, member_id) DO NOTHING
    `, [groupId, targetMemberId || null, targetName || "Member"]);

    res.json({ message: "Joined small group successfully!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

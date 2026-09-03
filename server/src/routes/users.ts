import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles, logAuditAction } from "../middleware/auth";

const router = Router();

// List all roles
router.get("/roles", async (req: Request, res: Response) => {
  try {
    const roles = await db.all(`
      SELECT r.*, COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id
      ORDER BY r.id ASC
    `);

    const roleDescriptions: Record<string, string> = {
      "Admin": "Full administrative privileges: user accounts, system configuration, master lookups, audit logs, and church-wide oversight.",
      "Coordinator": "Ministry department leader: manages age-bracket ministries, events, volunteer assignments, and discipleship curriculum.",
      "Leader": "Small group / Ministry leader: leads Bible study groups, records discipleship progress, and facilitates group fellowship.",
      "Volunteer": "Ministry helper: facilitates Sunday check-ins, attendance tracking, and event logistics.",
      "Member": "Regular church attendee / covenant member: views community announcements, submits prayer requests, registers for events, and joins Bible studies."
    };

    const formatted = roles.map(r => ({
      ...r,
      user_count: Number(r.user_count || 0),
      description: roleDescriptions[r.name] || "Standard role access"
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List users with filtering (Accessible to authenticated staff/leaders for lookups)
router.get("/users", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { role_id, role_name, search } = req.query;

    let query = `
      SELECT u.id, u.name, u.username, u.email, u.role_id, u.created_at,
             r.name as role_name,
             m.id as member_id, m.first_name as member_first_name, m.last_name as member_last_name,
             m.contact_phone, m.contact_email,
             m.status as member_status, m.birthdate as member_birthdate
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN members m ON m.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (role_id) {
      params.push(role_id);
      query += ` AND u.role_id = $${params.length}`;
    }

    if (role_name && typeof role_name === "string") {
      params.push(role_name);
      query += ` AND LOWER(r.name) = LOWER($${params.length})`;
    }

    if (search && typeof search === "string") {
      params.push(`%${search}%`);
      const pIdx = params.length;
      query += ` AND (u.name ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR (u.username IS NOT NULL AND u.username ILIKE $${pIdx}))`;
    }

    query += " ORDER BY u.role_id ASC, u.name ASC";

    const users = await db.all(query, params);

    const formatted = await Promise.all(users.map(async (u) => {
      const ministries = await db.all(`
        SELECT m.id, m.name, m.color
        FROM user_ministries um
        JOIN ministries m ON um.ministry_id = m.id
        WHERE um.user_id = $1
      `, [u.id]);

      return {
        ...u,
        contact_phone: u.contact_phone || null,
        contact_email: u.contact_email || u.email,
        ministries,
        linked_member_name: u.member_first_name ? `${u.member_first_name} ${u.member_last_name}` : null
      };
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get user by ID (Admin only)
router.get("/users/:id", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const user = await db.get(`
      SELECT u.id, u.name, u.username, u.email, u.role_id, u.created_at,
             r.name as role_name,
             m.id as member_id, m.first_name as member_first_name, m.last_name as member_last_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN members m ON m.user_id = u.id
      WHERE u.id = $1
    `, [id]);

    if (!user) return res.status(404).json({ error: "User not found" });

    const ministries = await db.all(`
      SELECT m.id, m.name, m.color
      FROM user_ministries um
      JOIN ministries m ON um.ministry_id = m.id
      WHERE um.user_id = $1
    `, [user.id]);

    res.json({
      ...user,
      ministries,
      linked_member_name: user.member_first_name ? `${user.member_first_name} ${user.member_last_name}` : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create user (Admin only)
router.post("/users", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { name, username, email, password, role_id, ministry_ids, member_id } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
    if (!email || !email.trim()) return res.status(400).json({ error: "Email is required" });
    if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    if (!role_id) return res.status(400).json({ error: "Role is required" });

    const cleanUsername = (username && username.trim()) 
      ? username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")
      : email.trim().toLowerCase().split("@")[0].replace(/[^a-z0-9._-]/g, "");

    const existingEmail = await db.get("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email.trim()]);
    if (existingEmail) return res.status(400).json({ error: "A user with this email already exists" });

    if (cleanUsername) {
      const existingUser = await db.get("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [cleanUsername]);
      if (existingUser) return res.status(400).json({ error: "A user with this username already exists" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const result = await db.run(`
      INSERT INTO users (name, username, email, password_hash, role_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [name.trim(), cleanUsername || null, email.trim().toLowerCase(), passwordHash, Number(role_id)]);

    const newUserId = result.lastInsertRowid;

    // Link ministries if coordinator/volunteer
    if (Array.isArray(ministry_ids)) {
      for (const mId of ministry_ids) {
        if (mId) {
          await db.run("INSERT INTO user_ministries (user_id, ministry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [newUserId, Number(mId)]);
        }
      }
    }

    // Link member profile if provided
    if (member_id) {
      await db.run("UPDATE members SET user_id = $1 WHERE id = $2", [newUserId, Number(member_id)]);
    }

    const role = await db.get("SELECT name FROM roles WHERE id = $1", [role_id]);
    await logAuditAction(req.user?.id || null, "CREATE", "users", newUserId, `Created user account '${name.trim()}' (${cleanUsername}) with role ${role?.name || role_id}`);

    res.status(201).json({ id: newUserId, message: "User account created successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update user (Admin only)
router.put("/users/:id", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { name, username, email, password, role_id, ministry_ids, member_id } = req.body;

    const current = await db.get("SELECT * FROM users WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "User not found" });

    if (email && email.trim().toLowerCase() !== current.email.toLowerCase()) {
      const duplicate = await db.get("SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2", [email.trim(), id]);
      if (duplicate) return res.status(400).json({ error: "Another user already has this email" });
    }

    let cleanUsername = current.username;
    if (username !== undefined) {
      cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
      if (cleanUsername && cleanUsername !== current.username) {
        const duplicateUsername = await db.get("SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2", [cleanUsername, id]);
        if (duplicateUsername) return res.status(400).json({ error: "Another user already has this username" });
      }
    }

    let newHash = current.password_hash;
    if (password && password.trim().length >= 6) {
      newHash = bcrypt.hashSync(password.trim(), 10);
    }

    await db.run(`
      UPDATE users
      SET name = $1, username = $2, email = $3, password_hash = $4, role_id = $5
      WHERE id = $6
    `, [
      name !== undefined ? name.trim() : current.name,
      cleanUsername || null,
      email !== undefined ? email.trim().toLowerCase() : current.email,
      newHash,
      role_id !== undefined ? Number(role_id) : current.role_id,
      id
    ]);

    // Update ministry assignments
    if (Array.isArray(ministry_ids)) {
      await db.run("DELETE FROM user_ministries WHERE user_id = $1", [id]);
      for (const mId of ministry_ids) {
        if (mId) {
          await db.run("INSERT INTO user_ministries (user_id, ministry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [Number(id), Number(mId)]);
        }
      }
    }

    // Update linked member
    if (member_id !== undefined) {
      await db.run("UPDATE members SET user_id = NULL WHERE user_id = $1", [id]);
      if (member_id) {
        await db.run("UPDATE members SET user_id = $1 WHERE id = $2", [Number(id), Number(member_id)]);
      }
    }

    await logAuditAction(req.user?.id || null, "UPDATE", "users", Number(id), `Updated user account '${name || current.name}'`);
    res.json({ message: "User account updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (Admin only)
router.delete("/users/:id", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;

    if (Number(id) === 1) {
      return res.status(403).json({ error: "Cannot delete root system administrator (ID 1)" });
    }
    if (req.user && req.user.id === Number(id)) {
      return res.status(403).json({ error: "Cannot delete your own active user account" });
    }

    const current = await db.get("SELECT * FROM users WHERE id = $1", [id]);
    if (!current) return res.status(404).json({ error: "User not found" });

    await db.run("UPDATE members SET user_id = NULL WHERE user_id = $1", [id]);
    await db.run("DELETE FROM user_ministries WHERE user_id = $1", [id]);
    await db.run("DELETE FROM users WHERE id = $1", [id]);

    await logAuditAction(req.user?.id || null, "DELETE", "users", Number(id), `Deleted user account: ${current.name} (${current.email})`);
    res.json({ message: `User '${current.name}' deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

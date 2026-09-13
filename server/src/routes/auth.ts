import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, JWT_SECRET, logAuditAction } from "../middleware/auth";

const router = Router();

// Setup status check: whether any users exist in the system
router.get("/setup-status", async (_req: Request, res: Response) => {
  try {
    const userCount = await db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM users");
    const adminCount = await db.get<{ count: string | number }>(`
      SELECT COUNT(*) as count 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE LOWER(r.name) = 'admin'
    `);
    const count = Number(userCount?.count || 0);
    const admins = Number(adminCount?.count || 0);
    res.json({
      hasUsers: count > 0,
      totalUsers: count,
      hasAdmin: admins > 0,
      totalAdmins: admins,
      isFirstUser: count === 0 || admins === 0
    });
  } catch (err: any) {
    console.error("Auth /setup-status error:", err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Register / Create Account (Automatically grants Admin if 0 users or 0 admins exist)
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, username, email, password, role_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email address is required" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Determine clean username (from input or fallback to email prefix)
    const cleanUsername = (username && username.trim()) 
      ? username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")
      : email.trim().toLowerCase().split("@")[0].replace(/[^a-z0-9._-]/g, "");

    // Check duplicate email
    const existingEmail = await db.get("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email.trim()]);
    if (existingEmail) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    // Check duplicate username
    if (cleanUsername) {
      const existingUser = await db.get("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [cleanUsername]);
      if (existingUser) {
        return res.status(400).json({ error: "This username is already taken. Please choose another username." });
      }
    }

    // Check if system has 0 users or 0 admins (First admin setup)
    const userCount = await db.get<{ count: string | number }>("SELECT COUNT(*) as count FROM users");
    const adminCount = await db.get<{ count: string | number }>(`
      SELECT COUNT(*) as count 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE LOWER(r.name) = 'admin'
    `);
    const totalUsers = Number(userCount?.count || 0);
    const totalAdmins = Number(adminCount?.count || 0);
    const isFirstUser = totalUsers === 0;
    const isFirstAdmin = totalAdmins === 0;

    // Fetch Admin & Member roles dynamically from the database
    const adminRole = await db.get<{ id: number }>("SELECT id FROM roles WHERE LOWER(name) = 'admin'");
    const memberRole = await db.get<{ id: number }>("SELECT id FROM roles WHERE LOWER(name) = 'member'");

    const adminRoleId = adminRole?.id || 1;
    const defaultRoleId = memberRole?.id || (role_id ? Number(role_id) : 4);

    // If users count is 0 OR no Admin exists, ALWAYS assign the Admin role; otherwise use specified role or Member default
    const assignedRoleId = (isFirstUser || isFirstAdmin) ? adminRoleId : (role_id ? Number(role_id) : defaultRoleId);

    const passwordHash = bcrypt.hashSync(password.trim(), 10);

    const result = await db.run(`
      INSERT INTO users (name, username, email, password_hash, role_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [name.trim(), cleanUsername || null, email.trim().toLowerCase(), passwordHash, assignedRoleId]);

    const newUserId = result.lastInsertRowid;

    // Fetch created user with role
    const user = await db.get(`
      SELECT u.id, u.name, u.username, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [newUserId]);

    const ministryRows = await db.all(`
      SELECT m.id, m.name, m.color
      FROM user_ministries um
      JOIN ministries m ON um.ministry_id = m.id
      WHERE um.user_id = $1
    `, [newUserId]);

    await logAuditAction(
      newUserId,
      "CREATE",
      "users",
      newUserId,
      isFirstUser 
        ? `Initial Master Admin account created for ${name.trim()} (${cleanUsername || email.trim()})` 
        : `New user registered: ${name.trim()} (${cleanUsername || email.trim()}) with role ${user?.role_name || assignedRoleId}`
    );

    const token = jwt.sign({ id: newUserId }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      token,
      isFirstUser,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
        role_name: user.role_name,
        ministries: ministryRows
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login (supports both Email and Username)
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, username, emailOrUsername, password } = req.body;
    const identifier = (emailOrUsername || email || username || "").trim();

    if (!identifier || !password) {
      return res.status(400).json({ error: "Email/Username and password are required" });
    }

    const user = await db.get(`
      SELECT u.id, u.name, u.username, u.email, u.password_hash, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.email) = LOWER($1) OR (u.username IS NOT NULL AND LOWER(u.username) = LOWER($1))
    `, [identifier]);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid email/username or password" });
    }

    const ministryRows = await db.all(`
      SELECT m.id, m.name, m.color
      FROM user_ministries um
      JOIN ministries m ON um.ministry_id = m.id
      WHERE um.user_id = $1
    `, [user.id]);

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
        role_name: user.role_name,
        ministries: ministryRows
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Demo accounts endpoint for fast testing & evaluation
router.get("/demo-users", async (req: Request, res: Response) => {
  try {
    const users = await db.all(`
      SELECT u.id, u.name, u.username, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.role_id ASC
    `);

    const formatted = await Promise.all(users.map(async (u) => {
      const ministries = await db.all(`
        SELECT m.id, m.name, m.color
        FROM user_ministries um
        JOIN ministries m ON um.ministry_id = m.id
        WHERE um.user_id = $1
      `, [u.id]);

      return {
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        role_id: u.role_id,
        role_name: u.role_name,
        ministries
      };
    }));

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Instant switch demo user (generates valid JWT)
router.post("/switch-demo", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const user = await db.get(`
      SELECT u.id, u.name, u.username, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [userId]);

    if (!user) {
      return res.status(404).json({ error: "Demo user not found" });
    }

    const ministryRows = await db.all(`
      SELECT m.id, m.name, m.color
      FROM user_ministries um
      JOIN ministries m ON um.ministry_id = m.id
      WHERE um.user_id = $1
    `, [user.id]);

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
        role_name: user.role_name,
        ministries: ministryRows
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get current session
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const ministryRows = await db.all(`
      SELECT m.id, m.name, m.color
      FROM user_ministries um
      JOIN ministries m ON um.ministry_id = m.id
      WHERE um.user_id = $1
    `, [req.user.id]);

    const memberRecord = await db.get(`
      SELECT m.*, h.name as household_name
      FROM members m
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.user_id = $1
    `, [req.user.id]);

    res.json({
      user: {
        ...req.user,
        ministries: ministryRows,
        member: memberRecord || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update current user profile (Accessible to all authenticated roles)
router.put("/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.id;
    const {
      name,
      username,
      email,
      contact_phone,
      birthdate,
      gender,
      address,
      occupation,
      hobbies,
      school_name,
      program_major,
      guardian_names,
      guardian_phone,
      family_details,
      facebook_account
    } = req.body;

    const current = await db.get("SELECT * FROM users WHERE id = $1", [userId]);
    if (!current) return res.status(404).json({ error: "User not found" });

    // Validate email if changed
    if (email && email.trim().toLowerCase() !== current.email.toLowerCase()) {
      const duplicate = await db.get("SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2", [email.trim(), userId]);
      if (duplicate) return res.status(400).json({ error: "Another user already has this email address" });
    }

    // Validate username if changed
    let cleanUsername = current.username;
    if (username !== undefined) {
      cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
      if (cleanUsername && cleanUsername !== current.username) {
        const duplicateUsername = await db.get("SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2", [cleanUsername, userId]);
        if (duplicateUsername) return res.status(400).json({ error: "This username is already taken" });
      }
    }

    // Update users table
    await db.run(`
      UPDATE users
      SET name = $1, username = $2, email = $3
      WHERE id = $4
    `, [
      name !== undefined && name.trim() ? name.trim() : current.name,
      cleanUsername || null,
      email !== undefined && email.trim() ? email.trim().toLowerCase() : current.email,
      userId
    ]);

    // Check if user has a linked member record
    const linkedMember = await db.get("SELECT id, first_name, last_name FROM members WHERE user_id = $1", [userId]);
    if (linkedMember) {
      const nameParts = (name !== undefined && name.trim() ? name.trim() : current.name).split(" ");
      const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : (linkedMember.last_name || "");

      await db.run(`
        UPDATE members
        SET first_name = $1,
            last_name = $2,
            contact_email = $3,
            contact_phone = COALESCE($4, contact_phone),
            birthdate = COALESCE($5, birthdate),
            gender = COALESCE($6, gender),
            address = COALESCE($7, address),
            occupation = COALESCE($8, occupation),
            hobbies = COALESCE($9, hobbies),
            school_name = COALESCE($10, school_name),
            program_major = COALESCE($11, program_major),
            guardian_names = COALESCE($12, guardian_names),
            guardian_phone = COALESCE($13, guardian_phone),
            family_details = COALESCE($14, family_details),
            facebook_account = COALESCE($15, facebook_account)
        WHERE id = $16
      `, [
        firstName,
        lastName,
        email !== undefined && email.trim() ? email.trim().toLowerCase() : current.email,
        contact_phone !== undefined ? contact_phone : null,
        birthdate !== undefined && birthdate ? birthdate : null,
        gender !== undefined ? gender : null,
        address !== undefined ? address : null,
        occupation !== undefined ? occupation : null,
        hobbies !== undefined ? hobbies : null,
        school_name !== undefined ? school_name : null,
        program_major !== undefined ? program_major : null,
        guardian_names !== undefined ? guardian_names : null,
        guardian_phone !== undefined ? guardian_phone : null,
        family_details !== undefined ? family_details : null,
        facebook_account !== undefined ? facebook_account : null,
        linkedMember.id
      ]);
    }

    await logAuditAction(userId, "UPDATE", "users", userId, `User '${name || current.name}' updated their profile details`);

    // Fetch updated user
    const updatedUser = await db.get(`
      SELECT u.id, u.name, u.username, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [userId]);

    const ministryRows = await db.all(`
      SELECT m.id, m.name, m.color
      FROM user_ministries um
      JOIN ministries m ON um.ministry_id = m.id
      WHERE um.user_id = $1
    `, [userId]);

    const memberRecord = await db.get(`
      SELECT m.*, h.name as household_name
      FROM members m
      LEFT JOIN households h ON m.household_id = h.id
      WHERE m.user_id = $1
    `, [userId]);

    res.json({
      message: "Profile updated successfully",
      user: {
        ...updatedUser,
        ministries: ministryRows,
        member: memberRecord || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Change own password (Accessible to all authenticated roles)
router.put("/change-password", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required" });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await db.get("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: "Incorrect current password" });
    }

    const newHash = bcrypt.hashSync(newPassword.trim(), 10);
    await db.run("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.user.id]);

    await logAuditAction(req.user.id, "UPDATE", "users", req.user.id, `User changed their account password`);
    res.json({ message: "Password changed successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get profile activity & metrics for the current user
router.get("/profile-activity", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.id;

    // Check linked member
    const member = await db.get("SELECT id FROM members WHERE user_id = $1", [userId]);
    const memberId = member?.id;

    let attendanceCount = 0;
    if (memberId) {
      const att = await db.get<{ count: string | number }>(
        "SELECT COUNT(*) as count FROM attendance_records WHERE member_id = $1",
        [memberId]
      );
      attendanceCount = Number(att?.count || 0);
    }

    // Check life groups led or attended
    const groupsLed = await db.all(
      "SELECT id, name, schedule_day, schedule_time, meeting_location FROM bible_study_groups WHERE leader_id = $1",
      [userId]
    );

    let groupsAttended: any[] = [];
    if (memberId) {
      groupsAttended = await db.all(`
        SELECT bsg.id, bsg.name, bsg.schedule_day, bsg.schedule_time, bsg.meeting_location
        FROM bible_study_members bsm
        JOIN bible_study_groups bsg ON bsm.group_id = bsg.id
        WHERE bsm.member_id = $1
      `, [memberId]);
    }

    // Check Saturday / Sunday duties if any
    let dutiesAssigned: any[] = [];
    if (memberId) {
      dutiesAssigned = await db.all(`
        SELECT dtm.team_id, dt.name as team_name, dtm.role as duty_role
        FROM duty_team_members dtm
        JOIN duty_teams dt ON dtm.team_id = dt.id
        WHERE dtm.member_id = $1
      `, [memberId]);
    }

    res.json({
      attendanceCount,
      groupsLed,
      groupsAttended,
      dutiesAssigned
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

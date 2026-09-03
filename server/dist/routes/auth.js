"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Setup status check: whether any users exist in the system
router.get("/setup-status", async (_req, res) => {
    try {
        const userCount = await schema_1.db.get("SELECT COUNT(*) as count FROM users");
        const count = Number(userCount?.count || 0);
        res.json({
            hasUsers: count > 0,
            totalUsers: count,
            isFirstUser: count === 0
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Register / Create Account (Automatically grants Admin if 0 users exist)
router.post("/register", async (req, res) => {
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
        const existingEmail = await schema_1.db.get("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email.trim()]);
        if (existingEmail) {
            return res.status(400).json({ error: "An account with this email already exists" });
        }
        // Check duplicate username
        if (cleanUsername) {
            const existingUser = await schema_1.db.get("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [cleanUsername]);
            if (existingUser) {
                return res.status(400).json({ error: "This username is already taken. Please choose another username." });
            }
        }
        // Check if system has 0 users
        const userCount = await schema_1.db.get("SELECT COUNT(*) as count FROM users");
        const isFirstUser = Number(userCount?.count || 0) === 0;
        // First user is always Admin (1), subsequent users default to Member (4) unless specified
        const assignedRoleId = isFirstUser ? 1 : (role_id ? Number(role_id) : 4);
        const passwordHash = bcryptjs_1.default.hashSync(password.trim(), 10);
        const result = await schema_1.db.run(`
      INSERT INTO users (name, username, email, password_hash, role_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [name.trim(), cleanUsername || null, email.trim().toLowerCase(), passwordHash, assignedRoleId]);
        const newUserId = result.lastInsertRowid;
        // Fetch created user with role
        const user = await schema_1.db.get(`
      SELECT u.id, u.name, u.username, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [newUserId]);
        const ministryRows = await schema_1.db.all(`
      SELECT m.id, m.name, m.color
      FROM user_ministries um
      JOIN ministries m ON um.ministry_id = m.id
      WHERE um.user_id = $1
    `, [newUserId]);
        await (0, auth_1.logAuditAction)(newUserId, "CREATE", "users", newUserId, isFirstUser
            ? `Initial Master Admin account created for ${name.trim()} (${cleanUsername || email.trim()})`
            : `New user registered: ${name.trim()} (${cleanUsername || email.trim()}) with role ${user?.role_name || assignedRoleId}`);
        const token = jsonwebtoken_1.default.sign({ id: newUserId }, auth_1.JWT_SECRET, { expiresIn: "7d" });
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Login (supports both Email and Username)
router.post("/login", async (req, res) => {
    try {
        const { email, username, emailOrUsername, password } = req.body;
        const identifier = (emailOrUsername || email || username || "").trim();
        if (!identifier || !password) {
            return res.status(400).json({ error: "Email/Username and password are required" });
        }
        const user = await schema_1.db.get(`
      SELECT u.id, u.name, u.username, u.email, u.password_hash, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.email) = LOWER($1) OR (u.username IS NOT NULL AND LOWER(u.username) = LOWER($1))
    `, [identifier]);
        if (!user || !bcryptjs_1.default.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: "Invalid email/username or password" });
        }
        const ministryRows = await schema_1.db.all(`
      SELECT m.id, m.name, m.color
      FROM user_ministries um
      JOIN ministries m ON um.ministry_id = m.id
      WHERE um.user_id = $1
    `, [user.id]);
        const token = jsonwebtoken_1.default.sign({ id: user.id }, auth_1.JWT_SECRET, { expiresIn: "7d" });
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Demo accounts endpoint for fast testing & evaluation
router.get("/demo-users", async (req, res) => {
    try {
        const users = await schema_1.db.all(`
      SELECT u.id, u.name, u.username, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.role_id ASC
    `);
        const formatted = await Promise.all(users.map(async (u) => {
            const ministries = await schema_1.db.all(`
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Instant switch demo user (generates valid JWT)
router.post("/switch-demo", async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await schema_1.db.get(`
      SELECT u.id, u.name, u.username, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [userId]);
        if (!user) {
            return res.status(404).json({ error: "Demo user not found" });
        }
        const ministryRows = await schema_1.db.all(`
      SELECT m.id, m.name, m.color
      FROM user_ministries um
      JOIN ministries m ON um.ministry_id = m.id
      WHERE um.user_id = $1
    `, [user.id]);
        const token = jsonwebtoken_1.default.sign({ id: user.id }, auth_1.JWT_SECRET, { expiresIn: "7d" });
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get current session
router.get("/me", auth_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const ministryRows = await schema_1.db.all(`
      SELECT m.id, m.name, m.color
      FROM user_ministries um
      JOIN ministries m ON um.ministry_id = m.id
      WHERE um.user_id = $1
    `, [req.user.id]);
        const memberRecord = await schema_1.db.get(`
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = void 0;
exports.authMiddleware = authMiddleware;
exports.optionalAuthMiddleware = optionalAuthMiddleware;
exports.requireRoles = requireRoles;
exports.requireMinistryScope = requireMinistryScope;
exports.logAuditAction = logAuditAction;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const schema_1 = require("../db/schema");
exports.JWT_SECRET = process.env.JWT_SECRET || "chms_super_secure_jwt_secret_key_2026";
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required" });
    }
    const token = authHeader.substring(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, exports.JWT_SECRET);
        // Fetch full user state including role and assigned ministries from PostgreSQL
        const userRow = await schema_1.db.get(`
      SELECT u.id, u.name, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [payload.id]);
        if (!userRow) {
            return res.status(401).json({ error: "User no longer exists" });
        }
        const ministryRows = await schema_1.db.all(`
      SELECT ministry_id FROM user_ministries WHERE user_id = $1
    `, [payload.id]);
        req.user = {
            id: userRow.id,
            name: userRow.name,
            email: userRow.email,
            role_id: userRow.role_id,
            role_name: userRow.role_name,
            ministry_ids: ministryRows.map(m => m.ministry_id)
        };
        next();
    }
    catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}
async function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
            const token = authHeader.substring(7);
            const payload = jsonwebtoken_1.default.verify(token, exports.JWT_SECRET);
            const userRow = await schema_1.db.get(`
        SELECT u.id, u.name, u.email, u.role_id, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `, [payload.id]);
            if (userRow) {
                const ministryRows = await schema_1.db.all(`
          SELECT ministry_id FROM user_ministries WHERE user_id = $1
        `, [payload.id]);
                req.user = {
                    id: userRow.id,
                    name: userRow.name,
                    email: userRow.email,
                    role_id: userRow.role_id,
                    role_name: userRow.role_name,
                    ministry_ids: ministryRows.map(m => m.ministry_id)
                };
            }
        }
        catch {
            // ignore token error for optional auth
        }
    }
    next();
}
function requireRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        if (!allowedRoles.includes(req.user.role_name)) {
            return res.status(403).json({ error: `Access denied. Requires one of roles: ${allowedRoles.join(", ")}` });
        }
        next();
    };
}
function requireMinistryScope(paramKey = "ministryId") {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        // Admins have universal access across all ministries
        if (req.user.role_name === "Admin") {
            return next();
        }
        const ministryId = parseInt(req.params[paramKey] || req.body[paramKey] || req.query[paramKey]);
        if (!ministryId) {
            return next();
        }
        if (!req.user.ministry_ids.includes(ministryId)) {
            return res.status(403).json({ error: "Access denied. You do not have permission to manage this ministry." });
        }
        next();
    };
}
async function logAuditAction(userId, action, targetTable, targetId, details) {
    try {
        await schema_1.db.run(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, action, targetTable, targetId, details]);
    }
    catch (err) {
        console.error("Failed to write audit log:", err);
    }
}

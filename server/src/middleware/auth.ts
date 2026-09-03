import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sql, db } from "../db/schema";

export const JWT_SECRET = process.env.JWT_SECRET || "chms_super_secure_jwt_secret_key_2026";

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  ministry_ids: number[];
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number };

    // Fetch full user state including role and assigned ministries from PostgreSQL
    const userRow = await db.get(`
      SELECT u.id, u.name, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [payload.id]);

    if (!userRow) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    const ministryRows = await db.all<{ ministry_id: number }>(`
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
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const payload = jwt.verify(token, JWT_SECRET) as { id: number };
      const userRow = await db.get(`
        SELECT u.id, u.name, u.email, u.role_id, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `, [payload.id]);

      if (userRow) {
        const ministryRows = await db.all<{ ministry_id: number }>(`
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
    } catch {
      // ignore token error for optional auth
    }
  }
  next();
}

export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ error: `Access denied. Requires one of roles: ${allowedRoles.join(", ")}` });
    }
    next();
  };
}

export function requireMinistryScope(paramKey: string = "ministryId") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    // Admins have universal access across all ministries
    if (req.user.role_name === "Admin") {
      return next();
    }

    const ministryId = parseInt(req.params[paramKey] || req.body[paramKey] || req.query[paramKey] as string);
    if (!ministryId) {
      return next();
    }

    if (!req.user.ministry_ids.includes(ministryId)) {
      return res.status(403).json({ error: "Access denied. You do not have permission to manage this ministry." });
    }
    next();
  };
}

export async function logAuditAction(userId: number | null, action: string, targetTable: string, targetId: number | null, details: string) {
  try {
    await db.run(`
      INSERT INTO audit_logs (user_id, action, target_table, target_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, action, targetTable, targetId, details]);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

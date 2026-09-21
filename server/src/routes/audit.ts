import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles } from "../middleware/auth";

const router = Router();

// Get audit trail (Admin only)
router.get("/", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, action, target_table } = req.query;

    let whereClause = " WHERE 1=1";
    const params: any[] = [];

    if (action && typeof action === "string") {
      params.push(action);
      whereClause += ` AND a.action = $${params.length}`;
    }

    if (target_table && typeof target_table === "string") {
      params.push(target_table);
      whereClause += ` AND a.target_table = $${params.length}`;
    }

    const isPaginated = page !== undefined || limit !== undefined;
    let totalCount = 0;
    const curPage = Math.max(1, page ? parseInt(String(page), 10) : 1);
    const curLimit = Math.min(100, Math.max(1, limit ? parseInt(String(limit), 10) : 50));

    if (isPaginated) {
      const countRes = await db.get<{ total: string | number }>(`
        SELECT COUNT(*) as total FROM audit_logs a ${whereClause}
      `, params);
      totalCount = parseInt(String(countRes?.total || 0), 10);
    }

    let query = `
      SELECT a.id, a.user_id, a.action, a.target_table, a.target_id, a.details, a.created_at,
             u.name as user_name, u.email as user_email, r.name as role_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY a.created_at DESC
    `;

    let logs: any[] = [];
    if (isPaginated) {
      const offset = (curPage - 1) * curLimit;
      const paginatedParams = [...params, curLimit, offset];
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      logs = await db.all(query, paginatedParams);
    } else {
      query += " LIMIT 100";
      logs = await db.all(query, params);
    }

    if (isPaginated) {
      res.json({
        data: logs,
        pagination: {
          total: totalCount,
          page: curPage,
          limit: curLimit,
          totalPages: Math.ceil(totalCount / curLimit) || 1
        }
      });
    } else {
      res.json(logs);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

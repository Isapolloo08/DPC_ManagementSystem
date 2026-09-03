import { Router, Request, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, requireRoles } from "../middleware/auth";

const router = Router();

// Get audit trail (Admin only)
router.get("/", authMiddleware, requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await db.all(`
      SELECT a.*, u.name as user_name, u.email as user_email, r.name as role_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

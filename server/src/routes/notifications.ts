import { Router, Response } from "express";
import { db } from "../db/schema";
import { authMiddleware, AuthRequest, logAuditAction, requireRoles } from "../middleware/auth";
import { processEmailOutbox } from "../services/emailOutboxWorker";
import {
  getPublicNotificationEmailSettings,
  NotificationEmailSettingsUpdate,
  saveNotificationEmailSettings
} from "../services/notificationSettings";
import { queueTestEmail } from "../services/notificationService";

const router = Router();
router.use(authMiddleware);

router.get("/unread-count", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role_name === "Admin";
    const row = await db.get<{ count: string }>(
      isAdmin
        ? "SELECT COUNT(*) AS count FROM notifications WHERE is_read = FALSE"
        : "SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
      isAdmin ? [] : [req.user!.id]
    );
    res.json({ count: Number(row?.count || 0) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to count notifications" });
  }
});

router.get("/rules", requireRoles("Admin"), async (_req: AuthRequest, res: Response) => {
  try {
    const rules = await db.all(`
      SELECT nr.*, m.name AS ministry_name
      FROM notification_rules nr
      LEFT JOIN ministries m ON m.id = nr.ministry_id
      ORDER BY nr.event_type ASC, nr.id ASC
    `);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load notification rules" });
  }
});

router.post("/rules", requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { event_type, recipient_type, recipient_value, ministry_id, threshold, email_enabled, in_app_enabled, enabled } = req.body;
    if (!event_type || !["user", "role", "email"].includes(recipient_type) || !String(recipient_value || "").trim()) {
      return res.status(400).json({ error: "Event type, recipient type, and recipient value are required" });
    }
    const row = await db.get<{ id: number }>(`
      INSERT INTO notification_rules (
        event_type, recipient_type, recipient_value, ministry_id, threshold,
        email_enabled, in_app_enabled, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      String(event_type).trim(), recipient_type, String(recipient_value).trim(), ministry_id || null,
      threshold || null, Boolean(email_enabled), in_app_enabled !== false, enabled !== false
    ]);
    await logAuditAction(req.user!.id, "CREATE_NOTIFICATION_RULE", "notification_rules", row!.id, `Created rule for ${event_type}`);
    res.status(201).json({ id: row!.id, message: "Notification rule created" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create notification rule" });
  }
});

router.put("/rules/:id", requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const current = await db.get<NotificationRuleUpdateRow>("SELECT * FROM notification_rules WHERE id = $1", [req.params.id]);
    if (!current) return res.status(404).json({ error: "Notification rule not found" });
    const { event_type, recipient_type, recipient_value, ministry_id, threshold, email_enabled, in_app_enabled, enabled } = req.body;
    const hasMinistry = Object.prototype.hasOwnProperty.call(req.body, "ministry_id");
    const hasThreshold = Object.prototype.hasOwnProperty.call(req.body, "threshold");
    await db.run(`
      UPDATE notification_rules SET
        event_type = $1,
        recipient_type = $2,
        recipient_value = $3,
        ministry_id = $4,
        threshold = $5,
        email_enabled = $6,
        in_app_enabled = $7,
        enabled = $8
      WHERE id = $9
    `, [
      event_type?.trim() || current.event_type,
      recipient_type || current.recipient_type,
      recipient_value?.trim() || current.recipient_value,
      hasMinistry ? (ministry_id || null) : current.ministry_id,
      hasThreshold ? (threshold || null) : current.threshold,
      email_enabled ?? current.email_enabled,
      in_app_enabled ?? current.in_app_enabled,
      enabled ?? current.enabled,
      req.params.id
    ]);
    await logAuditAction(req.user!.id, "UPDATE_NOTIFICATION_RULE", "notification_rules", Number(req.params.id), `Updated notification rule #${req.params.id}`);
    res.json({ message: "Notification rule updated" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update notification rule" });
  }
});

router.delete("/rules/:id", requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.run("DELETE FROM notification_rules WHERE id = $1", [req.params.id]);
    if (!result.changes) return res.status(404).json({ error: "Notification rule not found" });
    await logAuditAction(req.user!.id, "DELETE_NOTIFICATION_RULE", "notification_rules", Number(req.params.id), `Deleted notification rule #${req.params.id}`);
    res.json({ message: "Notification rule deleted" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete notification rule" });
  }
});

router.get("/email-settings", requireRoles("Admin"), async (_req: AuthRequest, res: Response) => {
  try {
    res.json(await getPublicNotificationEmailSettings());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load email settings" });
  }
});

router.put("/email-settings", requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const update = req.body as NotificationEmailSettingsUpdate;
    if (update.smtpPort !== undefined && (!Number.isInteger(Number(update.smtpPort)) || Number(update.smtpPort) < 1 || Number(update.smtpPort) > 65535)) {
      return res.status(400).json({ error: "SMTP port must be between 1 and 65535" });
    }
    await saveNotificationEmailSettings({ ...update, smtpPort: update.smtpPort === undefined ? undefined : Number(update.smtpPort) });
    await logAuditAction(req.user!.id, "UPDATE_SMTP_SETTINGS", "system_settings", null, "Updated notification and SMTP settings");
    res.json({ message: "Notification email settings saved", settings: await getPublicNotificationEmailSettings() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to save email settings" });
  }
});

router.post("/test-email", requireRoles("Admin"), async (req: AuthRequest, res: Response) => {
  try {
    const settings = await getPublicNotificationEmailSettings();
    const toEmail = String(req.body.to_email || settings.pastorEmail || req.user!.email).trim();
    if (!/^\S+@\S+\.\S+$/.test(toEmail)) return res.status(400).json({ error: "A valid test recipient email is required" });
    const outboxId = await queueTestEmail(toEmail, req.user!.id);
    void processEmailOutbox();
    await logAuditAction(req.user!.id, "SEND_TEST_EMAIL", "email_outbox", outboxId, `Queued test email to ${toEmail}`);
    res.status(202).json({ id: outboxId, message: "Test email queued. Offline failures will retry automatically." });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to queue test email" });
  }
});

router.patch("/read-all", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role_name === "Admin";
    const result = isAdmin
      ? await db.run("UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE")
      : await db.run("UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE", [req.user!.id]);
    res.json({ updated: result.changes });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to mark notifications read" });
  }
});

router.patch("/:id/read", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role_name === "Admin";
    const result = isAdmin
      ? await db.run("UPDATE notifications SET is_read = TRUE WHERE id = $1", [req.params.id])
      : await db.run("UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2", [req.params.id, req.user!.id]);
    if (!result.changes) return res.status(404).json({ error: "Notification not found" });
    res.json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update notification" });
  }
});

router.patch("/:id/unread", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role_name === "Admin";
    const result = isAdmin
      ? await db.run("UPDATE notifications SET is_read = FALSE WHERE id = $1", [req.params.id])
      : await db.run("UPDATE notifications SET is_read = FALSE WHERE id = $1 AND user_id = $2", [req.params.id, req.user!.id]);
    if (!result.changes) return res.status(404).json({ error: "Notification not found" });
    res.json({ message: "Notification marked as unread" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update notification" });
  }
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role_name === "Admin";
    const result = isAdmin
      ? await db.run("DELETE FROM notifications WHERE id = $1", [req.params.id])
      : await db.run("DELETE FROM notifications WHERE id = $1 AND user_id = $2", [req.params.id, req.user!.id]);
    if (!result.changes) return res.status(404).json({ error: "Notification not found" });
    res.json({ message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete notification" });
  }
});

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size) || 20));
    const offset = (page - 1) * pageSize;
    const isAdmin = req.user!.role_name === "Admin";

    const params: unknown[] = [];
    const whereClauses: string[] = [];

    if (!isAdmin || req.query.mine === "true") {
      params.push(req.user!.id);
      whereClauses.push(`n.user_id = $${params.length}`);
    } else if (req.query.user_id) {
      params.push(Number(req.query.user_id));
      whereClauses.push(`n.user_id = $${params.length}`);
    }

    if (req.query.unread === "true") {
      whereClauses.push("n.is_read = FALSE");
    }

    if (typeof req.query.type === "string" && req.query.type.trim()) {
      params.push(req.query.type.trim());
      whereClauses.push(`n.type = $${params.length}`);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRow = await db.get<{ count: string }>(`SELECT COUNT(*) AS count FROM notifications n ${where}`, params);
    const queryParams = [...params, pageSize, offset];
    const items = await db.all(`
      SELECT n.*, u.name AS recipient_name, u.email AS recipient_email
      FROM notifications n
      LEFT JOIN users u ON u.id = n.user_id
      ${where}
      ORDER BY n.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `, queryParams);
    const total = Number(countRow?.count || 0);
    res.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load notifications" });
  }
});

export default router;

interface NotificationRuleUpdateRow {
  event_type: string;
  recipient_type: "user" | "role" | "email";
  recipient_value: string;
  ministry_id: number | null;
  threshold: number | null;
  email_enabled: boolean;
  in_app_enabled: boolean;
  enabled: boolean;
}

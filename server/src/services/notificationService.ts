import { db } from "../db/schema";
import { emitUserEvent } from "../socket";
import { logger } from "../utils/logger";
import { getNotificationEmailSettings } from "./notificationSettings";
import { processEmailOutbox } from "./emailOutboxWorker";

export type NotificationEventType =
  | "absence_alert"
  | "session_rescheduled"
  | "at_risk_member"
  | "sunday_absence_streak"
  | "duty_incomplete"
  | "dishwashing_unresolved";

export interface NotifyPayload {
  eventKey: string;
  title: string;
  message: string;
  linkTab?: string;
  linkRefId?: number;
  ministryId?: number | null;
  roleUserIds?: Partial<Record<"Admin" | "Coordinator" | "Leader" | "Volunteer" | "Member", number[]>>;
  emailSubject?: string;
  emailHtml?: string;
}

interface NotificationRuleRow {
  id: number;
  recipient_type: "user" | "role" | "email";
  recipient_value: string;
  ministry_id: number | null;
  email_enabled: boolean;
  in_app_enabled: boolean;
}

interface RecipientUser {
  id: number;
  email: string;
}

export interface NotificationRecord {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  link_tab: string | null;
  link_ref_id: number | null;
  is_read: boolean;
  created_at: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function usersForRule(rule: NotificationRuleRow, payload: NotifyPayload): Promise<RecipientUser[]> {
  if (rule.recipient_type === "user") {
    const id = Number(rule.recipient_value);
    if (!Number.isInteger(id)) return [];
    const user = await db.get<RecipientUser>("SELECT id, email FROM users WHERE id = $1", [id]);
    return user ? [user] : [];
  }
  if (rule.recipient_type !== "role") return [];

  const scopedIds = payload.roleUserIds?.[rule.recipient_value as keyof NonNullable<NotifyPayload["roleUserIds"]>];
  if (scopedIds !== undefined) {
    if (scopedIds.length === 0) return [];
    return db.all<RecipientUser>("SELECT id, email FROM users WHERE id = ANY($1::int[])", [scopedIds]);
  }
  const effectiveMinistryId = rule.ministry_id ?? payload.ministryId ?? null;
  const params: unknown[] = [rule.recipient_value];
  let query = `
    SELECT DISTINCT u.id, u.email
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.name = $1
  `;

  if (effectiveMinistryId !== null && rule.recipient_value !== "Admin") {
    params.push(effectiveMinistryId);
    query += ` AND EXISTS (
      SELECT 1 FROM user_ministries um
      WHERE um.user_id = u.id AND um.ministry_id = $${params.length}
    )`;
  }

  return db.all<RecipientUser>(query, params);
}

async function claimDispatch(
  eventType: NotificationEventType,
  eventKey: string,
  channel: "in_app" | "email",
  recipient: string
): Promise<number | null> {
  const row = await db.get<{ id: number }>(`
    INSERT INTO notification_log (event_type, event_key, channel, recipient, status)
    VALUES ($1, $2, $3, $4, 'queued')
    ON CONFLICT (event_type, event_key, channel, recipient) DO NOTHING
    RETURNING id
  `, [eventType, eventKey, channel, recipient]);
  return row?.id ?? null;
}

async function dispatch(eventType: NotificationEventType, payload: NotifyPayload): Promise<void> {
  const rules = await db.all<NotificationRuleRow>(`
    SELECT id, recipient_type, recipient_value, ministry_id, email_enabled, in_app_enabled
    FROM notification_rules
    WHERE event_type = $1 AND enabled = TRUE
    ORDER BY id ASC
  `, [eventType]);

  const inAppUsers = new Map<number, RecipientUser>();
  const emailRecipients = new Map<string, string>();
  const emailSettings = await getNotificationEmailSettings();

  for (const rule of rules) {
    if (rule.recipient_type === "email") {
      const resolved = rule.recipient_value === "pastor" ? emailSettings.pastorEmail : rule.recipient_value;
      if (rule.email_enabled && resolved) emailRecipients.set(resolved.toLowerCase(), resolved);
      continue;
    }

    const users = await usersForRule(rule, payload);
    for (const user of users) {
      if (rule.in_app_enabled) inAppUsers.set(user.id, user);
      if (rule.email_enabled && user.email) emailRecipients.set(user.email.toLowerCase(), user.email);
    }
  }

  const emitted: NotificationRecord[] = [];
  let queuedEmails = 0;
  await db.transaction(async client => {
    for (const user of inAppUsers.values()) {
      const logResult = await client.query<{ id: number }>(`
        INSERT INTO notification_log (event_type, event_key, channel, recipient, status)
        VALUES ($1, $2, 'in_app', $3, 'queued')
        ON CONFLICT (event_type, event_key, channel, recipient) DO NOTHING
        RETURNING id
      `, [eventType, payload.eventKey, String(user.id)]);
      if (logResult.rows.length === 0) continue;

      const notificationResult = await client.query<NotificationRecord>(`
        INSERT INTO notifications (user_id, type, title, message, link_tab, link_ref_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [user.id, eventType, payload.title, payload.message, payload.linkTab || null, payload.linkRefId || null]);
      emitted.push(notificationResult.rows[0]);
      await client.query("UPDATE notification_log SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [logResult.rows[0].id]);
    }

    for (const email of emailRecipients.values()) {
      const logResult = await client.query<{ id: number }>(`
        INSERT INTO notification_log (event_type, event_key, channel, recipient, status)
        VALUES ($1, $2, 'email', $3, 'queued')
        ON CONFLICT (event_type, event_key, channel, recipient) DO NOTHING
        RETURNING id
      `, [eventType, payload.eventKey, email.toLowerCase()]);
      if (logResult.rows.length === 0) continue;
      const logId = logResult.rows[0].id;
      const fallbackHtml = `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${escapeHtml(payload.title)}</h2><p>${escapeHtml(payload.message).replace(/\n/g, "<br>")}</p></div>`;
      await client.query(`
        INSERT INTO email_outbox (notification_log_id, to_email, subject, body_html)
        VALUES ($1, $2, $3, $4)
      `, [logId, email, payload.emailSubject || payload.title, payload.emailHtml || fallbackHtml]);
      queuedEmails++;
    }
  });

  for (const notification of emitted) {
    emitUserEvent(notification.user_id, "notification:new", notification);
  }

  if (queuedEmails > 0) {
    void processEmailOutbox();
  }
}

export async function notify(eventType: NotificationEventType, payload: NotifyPayload): Promise<void> {
  try {
    await dispatch(eventType, payload);
  } catch (error) {
    logger.error({ error, eventType, eventKey: payload.eventKey }, "Notification dispatch failed");
  }
}

// Phase-two call sites can use these typed hooks without knowing delivery details.
export const notifyAtRiskMember = (payload: NotifyPayload) => notify("at_risk_member", payload);
export const notifySundayAbsenceStreak = (payload: NotifyPayload) => notify("sunday_absence_streak", payload);
export const notifyDutyIncomplete = (payload: NotifyPayload) => notify("duty_incomplete", payload);
export const notifyDishwashingUnresolved = (payload: NotifyPayload) => notify("dishwashing_unresolved", payload);

export async function queueTestEmail(toEmail: string, requestedBy: number): Promise<number> {
  const eventKey = `test:${requestedBy}:${Date.now()}`;
  const logId = await claimDispatch("absence_alert", eventKey, "email", toEmail.toLowerCase());
  if (!logId) throw new Error("Unable to queue test email");
  const result = await db.run(`
    INSERT INTO email_outbox (notification_log_id, to_email, subject, body_html)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [
    logId,
    toEmail,
    "DPC ChMS test email",
    "<div style=\"font-family:Arial,sans-serif;line-height:1.6\"><h2>DPC ChMS email is configured</h2><p>This test message was sent from the church management system.</p></div>"
  ]);
  return Number(result.lastInsertRowid);
}

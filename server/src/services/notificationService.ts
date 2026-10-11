import { db } from "../db/schema";
import { emitUserEvent,emitAuthorizedAdminEvent } from "../socket";
import { logger } from "../utils/logger";
import { getNotificationEmailSettings } from "./notificationSettings";
import { processEmailOutbox } from "./emailOutboxWorker";

/** Claim revisions individually, then update one event alert per Admin. */
export async function notifyPendingInvitations(source: string, pending: {submission:string;revision:string;event_identity:string;event_title:string;event_id:number|null}[]) {
  const admins=await db.all<{id:number}>("SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name IN ('Admin','IT Admin')");
  const groups=new Map<string,typeof pending>();
  for(const p of pending) groups.set(p.event_identity,[...(groups.get(p.event_identity)||[]),p]);
  for(const admin of admins) for(const [event,items] of groups) {
    const saved=await db.transaction(async c=>{
      let changed=false;
      for(const p of items) {
        const claim=await c.query(`INSERT INTO notification_log(event_type,event_key,channel,recipient,status) VALUES('online_invitation_submission',$1,'in_app',$2,'sent') ON CONFLICT DO NOTHING RETURNING id`,[source+':'+p.submission+':'+p.revision,String(admin.id)]);
        changed ||= !!claim.rowCount;
      }
      if(!changed) return null;
      const existing=await c.query("SELECT id FROM notifications WHERE user_id=$1 AND type='online_invitation_submission' AND invitation_event_identity=$2 ORDER BY id DESC LIMIT 1 FOR UPDATE",[admin.id,event]);
      const title='Online invitation submissions · '+items[0].event_title;
      const message=items.length+' pending submission(s) require manual Pull.'+(items[0].event_id?'':' Local event counterpart is not verified.');
      if(existing.rows[0]) return (await c.query('UPDATE notifications SET title=$1,message=$2,is_read=false,created_at=now(),link_ref_id=$3 WHERE id=$4 RETURNING *',[title.slice(0,255),message,items[0].event_id,existing.rows[0].id])).rows[0];
      return (await c.query(`INSERT INTO notifications(user_id,type,title,message,link_tab,link_ref_id,invitation_event_identity) VALUES($1,'online_invitation_submission',$2,$3,'events',$4,$5) RETURNING *`,[admin.id,title.slice(0,255),message,items[0].event_id,event])).rows[0];
    });
    if(saved) await emitAuthorizedAdminEvent(admin.id,'notification:updated',saved);
  }
}

export async function updateOnlineInvitationCounts() {
  const alerts=await db.all(`SELECT n.id,n.user_id,COUNT(p.submission) FILTER(WHERE r.submission IS NULL)::int AS pending,
      COUNT(p.submission) FILTER(WHERE r.submission IS NOT NULL AND NOT r.confirmed)::int AS confirming
    FROM notifications n JOIN invitation_sync_node node ON node.id=1
    LEFT JOIN invitation_sync_pending p ON p.event_identity=n.invitation_event_identity AND p.source=node.source_id
    LEFT JOIN invitation_sync_receipts r ON r.source=p.source AND r.receiver=node.identity AND r.submission=p.submission AND r.revision=p.revision
      AND EXISTS(SELECT 1 FROM event_invitation_responses b WHERE b.id=r.response_id AND b.sync_identity=r.submission AND b.sync_revision=r.revision)
    WHERE n.type='online_invitation_submission' GROUP BY n.id,n.user_id`);
  for(const a of alerts) {
    const message=a.pending+' pending submission(s) require manual Pull.'+(a.confirming?' '+a.confirming+' imported locally; confirmation pending.':'');
    const saved=await db.get('UPDATE notifications SET message=$1 WHERE id=$2 AND message<>$1 RETURNING *',[message,a.id]);
    if(saved)await emitAuthorizedAdminEvent(a.user_id,'notification:updated',saved);
  }
}

export type NotificationEventType =
  | "bible_study_update"
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

  if (effectiveMinistryId !== null && rule.recipient_value !== "Admin" && rule.recipient_value !== "Pastor" && rule.recipient_value !== "IT Admin") {
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

import nodemailer from "nodemailer";
import { db } from "../db/schema";
import { logger } from "../utils/logger";
import { getNotificationEmailSettings } from "./notificationSettings";

interface EmailOutboxRow {
  id: number;
  notification_log_id: number | null;
  to_email: string;
  subject: string;
  body_html: string;
  attempts: number;
}

const MAX_ATTEMPTS = 5;
const WORKER_INTERVAL_MS = 10 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
let processing = false;

export async function processEmailOutbox(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const settings = await getNotificationEmailSettings();
    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword || !settings.fromEmail) {
      await db.run(`
        UPDATE notification_log nl
        SET status = 'failed',
            details = jsonb_build_object('error', 'SMTP settings are incomplete'),
            updated_at = CURRENT_TIMESTAMP
        FROM email_outbox eo
        WHERE eo.notification_log_id = nl.id
          AND eo.status IN ('pending', 'failed')
          AND eo.attempts < $1
      `, [MAX_ATTEMPTS]);
      await db.run(`
        UPDATE email_outbox
        SET status = 'failed', last_error = 'SMTP settings are incomplete'
        WHERE status IN ('pending', 'failed') AND attempts < $1
      `, [MAX_ATTEMPTS]);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: { user: settings.smtpUser, pass: settings.smtpPassword },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000
    });

    const messages = await db.all<EmailOutboxRow>(`
      SELECT id, notification_log_id, to_email, subject, body_html, attempts
      FROM email_outbox
      WHERE status IN ('pending', 'failed') AND attempts < $1
      ORDER BY created_at ASC
      LIMIT 20
    `, [MAX_ATTEMPTS]);

    for (const message of messages) {
      try {
        await transporter.sendMail({
          from: { name: settings.fromName, address: settings.fromEmail },
          to: message.to_email,
          subject: message.subject,
          html: message.body_html
        });
        await db.run(`
          UPDATE email_outbox
          SET status = 'sent', attempts = attempts + 1, last_error = NULL, sent_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [message.id]);
        if (message.notification_log_id) {
          await db.run("UPDATE notification_log SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [message.notification_log_id]);
        }
      } catch (error) {
        const lastError = error instanceof Error ? error.message.slice(0, 2000) : "Unknown SMTP error";
        await db.run(`
          UPDATE email_outbox
          SET status = 'failed', attempts = attempts + 1, last_error = $1
          WHERE id = $2
        `, [lastError, message.id]);
        if (message.notification_log_id) {
          await db.run(`
            UPDATE notification_log
            SET status = 'failed', details = jsonb_build_object('error', $1::text), updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [lastError, message.notification_log_id]);
        }
        logger.warn({ emailOutboxId: message.id, error: lastError }, "Email delivery failed; retained for retry");
      }
    }
  } catch (error) {
    logger.error({ error }, "Email outbox worker failed");
  } finally {
    processing = false;
  }
}

export async function cleanupOldNotifications(): Promise<void> {
  try {
    const result = await db.run("DELETE FROM notifications WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'");
    if (result.changes > 0) logger.info({ deleted: result.changes }, "Deleted expired notifications");
  } catch (error) {
    logger.error({ error }, "Notification cleanup failed");
  }
}

export function startNotificationJobs(): void {
  void processEmailOutbox();
  void cleanupOldNotifications();
  const workerTimer = setInterval(() => void processEmailOutbox(), WORKER_INTERVAL_MS);
  const cleanupTimer = setInterval(() => void cleanupOldNotifications(), CLEANUP_INTERVAL_MS);
  workerTimer.unref();
  cleanupTimer.unref();
}

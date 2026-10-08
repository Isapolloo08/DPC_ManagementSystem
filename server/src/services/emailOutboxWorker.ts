import { db } from "../db/schema";
import { logger } from "../utils/logger";
import { getNotificationEmailSettings } from "./notificationSettings";
import type { PoolClient } from "pg";
import { emailConfigurationError, sendQueuedEmail, QueuedEmail } from './emailDelivery';

interface EmailOutboxRow extends QueuedEmail {
  notification_log_id: number | null;
  attempts: number;
}

const MAX_ATTEMPTS = 5;
const WORKER_INTERVAL_MS = 2 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
let processing = false;

export async function processEmailOutbox(): Promise<void> {
  if (processing) return;
  processing = true;
  let client: PoolClient | undefined;
  let locked = false;
  try {
    client = await db.pool.connect();
    // Local landing-page and desktop backends can both use the same queue.
    // A session lock keeps separate processes from sending the same message.
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(4476995, 1) AS locked");
    locked = lock.rows[0].locked;
    if (!locked) return;
    const messages = (await client.query<EmailOutboxRow>(`
      SELECT id, notification_log_id, to_email, subject, body_html, attempts, created_at
      FROM email_outbox
      WHERE status IN ('pending', 'failed') AND attempts < $1 AND next_attempt_at <= CURRENT_TIMESTAMP
      ORDER BY (status = 'pending') DESC, next_attempt_at ASC, created_at ASC
      LIMIT 10
    `, [MAX_ATTEMPTS])).rows;
    if (!messages.length) return;
    const settings = await getNotificationEmailSettings();
    const configurationError = emailConfigurationError(settings);
    if (configurationError) {
      await client.query(`
        UPDATE notification_log nl
        SET status = 'failed',
            details = jsonb_build_object('error', $2::text),
            updated_at = CURRENT_TIMESTAMP
        FROM email_outbox eo
        WHERE eo.notification_log_id = nl.id
          AND eo.status IN ('pending', 'failed')
          AND eo.attempts < $1
      `, [MAX_ATTEMPTS, configurationError]);
      await client.query(`
        UPDATE email_outbox
        SET status = 'failed', last_error = $2,
            next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '1 minute'
        WHERE status IN ('pending', 'failed') AND attempts < $1
      `, [MAX_ATTEMPTS, configurationError]);
      return;
    }

    const deliver = async (message: EmailOutboxRow) => {
      try {
        await sendQueuedEmail(message, settings);
        await client!.query(`
          UPDATE email_outbox
          SET status = 'sent', attempts = attempts + 1, last_error = NULL, sent_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [message.id]);
        if (message.notification_log_id) {
          await client!.query("UPDATE notification_log SET status = 'sent', details = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [message.notification_log_id]);
        }
      } catch (error) {
        const lastError = error instanceof Error ? error.message.slice(0, 2000) : "Unknown email delivery error";
        const delaySeconds = [15, 60, 300, 900, 3600][Math.min(message.attempts, 4)];
        await client!.query(`
          UPDATE email_outbox
          SET status = 'failed', attempts = attempts + 1, last_error = $1,
              next_attempt_at = CURRENT_TIMESTAMP + $3 * INTERVAL '1 second'
          WHERE id = $2
        `, [lastError, message.id, delaySeconds]);
        if (message.notification_log_id) {
          await client!.query(`
            UPDATE notification_log
            SET status = 'failed', details = jsonb_build_object('error', $1::text), updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [lastError, message.notification_log_id]);
        }
        logger.warn({ emailOutboxId: message.id, error: lastError }, "Email delivery failed; retained for retry");
      }
    };
    // Two simultaneous sends share warm SMTP connections. A slow message no
    // longer blocks the next recipient while establishing a new connection.
    for (let offset = 0; offset < messages.length; offset += 2) {
      await Promise.all(messages.slice(offset, offset + 2).map(deliver));
    }
  } catch (error) {
    logger.error({ error }, "Email outbox worker failed");
  } finally {
    if (client) {
      let releaseError: Error | undefined;
      if (locked) {
        try { await client.query("SELECT pg_advisory_unlock(4476995, 1)"); }
        catch { releaseError = new Error("Email worker lock release failed"); }
      }
      client.release(releaseError);
    }
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

import type { PoolClient } from 'pg';
import { manilaToday, validateVisit } from './plannedVisits';

type VisitDetails = ReturnType<typeof validateVisit>['data'];
export interface VisitReceiptRow { receipt_id: string; payload_hash: string; created_at: Date | string; }

export function visitFollowUp(visitDate: string, submittedAt: Date | string) {
  const saturday = new Date(`${visitDate}T00:00:00Z`);
  saturday.setUTCDate(saturday.getUTCDate() - 1);
  const date = saturday.toISOString().slice(0, 10);
  if (date < manilaToday(new Date(submittedAt))) {
    return { date: null, message: 'Our welcome team will get in touch as soon as possible. You are welcome to come even if you haven’t heard from us yet.' };
  }
  const label = formatVisitDate(date);
  return { date, message: `Our welcome team usually follows up with new visitors on ${label}, before your Sunday visit. You are welcome to come even if you haven’t heard from us yet.` };
}

export function formatVisitDate(date: string) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function visitConfirmationEmail(data: VisitDetails, receipt: VisitReceiptRow) {
  const followUp = visitFollowUp(data.visit_date, receipt.created_at);
  return {
    subject: `Your Sunday visit to DPC · ${formatVisitDate(data.visit_date)}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#18303c;max-width:560px;margin:auto">
      <p style="color:#916b2b;font-size:12px;letter-spacing:2px">YOUR FIRST SUNDAY</p>
      <h1>We look forward to welcoming you.</h1>
      <p>Hello ${escapeHtml(data.full_name)},</p>
      <p>We’ve received your visit plan for Daet Presbyterian Church.</p>
      <h2>Your Sunday visit</h2>
      <p><strong>${formatVisitDate(data.visit_date)}</strong><br>Sunday worship: 10:00 AM–11:30 AM (Philippine time)<br>Arrive around 9:30 AM so our greeters can help you settle in.</p>
      <p>Purok 2, Brgy. Cobangbang, Daet, Camarines Norte. In front of Bicol CATV, near Mary’s Bright Montessori.</p>
      <p><a href="https://maps.google.com/?q=14.108300,122.959450">Open directions to DPC</a></p>
      <h2>When to expect a follow-up</h2>
      <p>${escapeHtml(followUp.message)}</p>
      <p>No registration is needed to attend. Come as you are; there’s a seat for you.</p>
      <p style="font-size:12px">Reference: ${escapeHtml(receipt.receipt_id)}</p>
      <p>Daet Presbyterian Church</p>
    </div>`,
  };
}

// Called in the visit transaction: a receipt and its email are committed together.
// The existing notification log prevents duplicate messages on concurrent retries.
export async function queueVisitConfirmation(client: PoolClient, data: VisitDetails, receipt: VisitReceiptRow) {
  if (!data.email) return 'not_requested' as const;
  const log = await client.query<{ id: number }>(`
    INSERT INTO notification_log (event_type, event_key, channel, recipient, status)
    VALUES ('planned_visit_confirmation', $1, 'email', $2, 'queued')
    ON CONFLICT (event_type, event_key, channel, recipient) DO NOTHING RETURNING id
  `, [receipt.receipt_id, data.email]);
  if (log.rows.length) {
    const email = visitConfirmationEmail(data, receipt);
    await client.query(`INSERT INTO email_outbox (notification_log_id, to_email, subject, body_html) VALUES ($1,$2,$3,$4)`, [log.rows[0].id, data.email, email.subject, email.html]);
  }
  const result = await client.query<{ status: 'pending' | 'sent' | 'failed' }>(`
    SELECT eo.status FROM email_outbox eo JOIN notification_log nl ON nl.id = eo.notification_log_id
    WHERE nl.event_type = 'planned_visit_confirmation' AND nl.event_key = $1 AND nl.channel = 'email' AND nl.recipient = $2
  `, [receipt.receipt_id, data.email]);
  if (!result.rows.length) throw new Error('Visit confirmation queue entry missing');
  return result.rows[0].status === 'pending' ? 'queued' as const : result.rows[0].status;
}

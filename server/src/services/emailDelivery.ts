import nodemailer from 'nodemailer';
import type SMTPPool from 'nodemailer/lib/smtp-pool';
import { createHash } from 'node:crypto';
import type { NotificationEmailSettings } from './notificationSettings';

export interface QueuedEmail {
  id: number;
  to_email: string;
  subject: string;
  body_html: string;
  created_at: Date | string;
}

let transport: nodemailer.Transporter<SMTPPool.SentMessageInfo> | undefined;
let signature = '';
const provider = () => process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'smtp');

export function emailConfigurationError(settings: NotificationEmailSettings) {
  if (provider() === 'resend') {
    return process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL ? null : 'Resend API key or verified sender is missing';
  }
  if (provider() !== 'smtp') return 'Unsupported email provider';
  return settings.smtpHost && settings.smtpUser && settings.smtpPassword && settings.fromEmail ? null : 'SMTP settings are incomplete';
}

export function closeEmailTransport() {
  transport?.close();
  transport = undefined;
  signature = '';
}

export async function sendQueuedEmail(message: QueuedEmail, settings: NotificationEmailSettings) {
  const configurationError = emailConfigurationError(settings);
  if (configurationError) throw new Error(configurationError);
  if (provider() === 'resend') {
    // HTTPS works on Render Free, where outbound SMTP ports are blocked.
    const idempotencyKey = createHash('sha256').update(`${message.id}:${new Date(message.created_at).toISOString()}:${message.to_email}`).digest('hex');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `dpc-${idempotencyKey}` },
      body: JSON.stringify({
        from: `"${settings.fromName.replace(/["\r\n]/g, '')}" <${process.env.RESEND_FROM_EMAIL}>`,
        to: [message.to_email], subject: message.subject, html: message.body_html,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => null) as { id?: string } | null;
    if (!response.ok || !result?.id) throw new Error(`Resend did not accept email (HTTP ${response.status})`);
    return;
  }

  const nextSignature = JSON.stringify([settings.smtpHost, settings.smtpPort, settings.smtpSecure, settings.smtpUser, settings.smtpPassword]);
  if (!transport || signature !== nextSignature) {
    closeEmailTransport();
    signature = nextSignature;
    transport = nodemailer.createTransport({
      pool: true, maxConnections: 2, maxMessages: 100,
      host: settings.smtpHost, port: settings.smtpPort, secure: settings.smtpSecure,
      auth: { user: settings.smtpUser, pass: settings.smtpPassword },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000, dnsTimeout: 10000,
    });
  }
  const info = await transport.sendMail({ from: { name: settings.fromName, address: settings.fromEmail }, to: message.to_email, subject: message.subject, html: message.body_html });
  if (!info.accepted?.length) throw new Error('SMTP did not accept the recipient');
}

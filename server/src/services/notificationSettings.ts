import crypto from "crypto";
import { db } from "../db/schema";
import { JWT_SECRET } from "../middleware/auth";

export interface NotificationEmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromName: string;
  fromEmail: string;
  pastorEmail: string;
}

export interface PublicNotificationEmailSettings extends Omit<NotificationEmailSettings, "smtpPassword"> {
  hasSmtpPassword: boolean;
}

const KEYS = {
  smtpHost: "notification_smtp_host",
  smtpPort: "notification_smtp_port",
  smtpSecure: "notification_smtp_secure",
  smtpUser: "notification_smtp_user",
  smtpPassword: "notification_smtp_password_encrypted",
  fromName: "notification_email_from_name",
  fromEmail: "notification_email_from_email",
  pastorEmail: "notification_pastor_email"
} as const;

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(process.env.SMTP_ENCRYPTION_KEY || JWT_SECRET).digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(part => part.toString("base64")).join(".");
}

function decryptSecret(value: string): string {
  if (!value) return "";
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) return "";
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final()
  ]).toString("utf8");
}

export async function getNotificationEmailSettings(): Promise<NotificationEmailSettings> {
  const rows = await db.all<{ key: string; value: string }>(
    "SELECT key, value FROM system_settings WHERE category = $1",
    ["notification_email"]
  );
  const values = new Map(rows.map(row => [row.key, row.value]));
  let storedPassword = "";
  try {
    storedPassword = decryptSecret(values.get(KEYS.smtpPassword) || "");
  } catch {
    storedPassword = "";
  }

  return {
    smtpHost: process.env.SMTP_HOST || values.get(KEYS.smtpHost) || "",
    smtpPort: Number(process.env.SMTP_PORT || values.get(KEYS.smtpPort) || 587),
    smtpSecure: String(process.env.SMTP_SECURE || values.get(KEYS.smtpSecure) || "false") === "true",
    smtpUser: process.env.SMTP_USER || values.get(KEYS.smtpUser) || "",
    smtpPassword: process.env.SMTP_PASSWORD || storedPassword,
    fromName: process.env.SMTP_FROM_NAME || values.get(KEYS.fromName) || "Daet Presbyterian Church",
    fromEmail: process.env.SMTP_FROM_EMAIL || values.get(KEYS.fromEmail) || values.get(KEYS.smtpUser) || "",
    pastorEmail: values.get(KEYS.pastorEmail) || process.env.PASTOR_EMAIL || ""
  };
}

export async function getPublicNotificationEmailSettings(): Promise<PublicNotificationEmailSettings> {
  const { smtpPassword, ...settings } = await getNotificationEmailSettings();
  return { ...settings, hasSmtpPassword: Boolean(smtpPassword) };
}

export interface NotificationEmailSettingsUpdate {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  fromName?: string;
  fromEmail?: string;
  pastorEmail?: string;
}

export async function saveNotificationEmailSettings(update: NotificationEmailSettingsUpdate): Promise<void> {
  const entries: Array<[string, string]> = [];
  if (update.smtpHost !== undefined) entries.push([KEYS.smtpHost, update.smtpHost.trim()]);
  if (update.smtpPort !== undefined) entries.push([KEYS.smtpPort, String(update.smtpPort)]);
  if (update.smtpSecure !== undefined) entries.push([KEYS.smtpSecure, String(update.smtpSecure)]);
  if (update.smtpUser !== undefined) entries.push([KEYS.smtpUser, update.smtpUser.trim()]);
  if (update.smtpPassword?.trim()) entries.push([KEYS.smtpPassword, encryptSecret(update.smtpPassword.trim())]);
  if (update.fromName !== undefined) entries.push([KEYS.fromName, update.fromName.trim()]);
  if (update.fromEmail !== undefined) entries.push([KEYS.fromEmail, update.fromEmail.trim()]);
  if (update.pastorEmail !== undefined) entries.push([KEYS.pastorEmail, update.pastorEmail.trim()]);

  await db.transaction(async client => {
    for (const [key, value] of entries) {
      await client.query(`
        INSERT INTO system_settings (key, value, category, updated_at)
        VALUES ($1, $2, 'notification_email', CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          category = EXCLUDED.category,
          updated_at = CURRENT_TIMESTAMP
      `, [key, value]);
    }
  });
}

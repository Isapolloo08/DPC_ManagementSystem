import assert from 'node:assert/strict';
import { after, test, TestContext } from 'node:test';
import nodemailer from 'nodemailer';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/schema';
import * as settingsModule from './notificationSettings';
import * as deliveryModule from './emailDelivery';
import { processEmailOutbox } from './emailOutboxWorker';

const settings: settingsModule.NotificationEmailSettings = { smtpHost: 'smtp.example.test', smtpPort: 587, smtpSecure: false, smtpUser: 'sender@example.test', smtpPassword: 'test-only', fromName: 'DPC', fromEmail: 'sender@example.test', pastorEmail: '' };
const message: deliveryModule.QueuedEmail = { id: 1, to_email: 'visitor@example.test', subject: 'Your visit', body_html: '<p>Welcome</p>', created_at: new Date('2026-10-08T09:00:00Z') };

function environment(t: TestContext, values: Record<string, string | undefined>) {
  const original = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  t.after(() => { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
}

test('SMTP reuses pooled connections, refreshes credentials and rejects unaccepted recipients', async t => {
  environment(t, { EMAIL_PROVIDER: 'smtp' });
  const smtp = { sendMail: async () => ({ accepted: [message.to_email] }), close: () => {} };
  const factory = t.mock.method(nodemailer, 'createTransport', () => smtp);
  const close = t.mock.method(smtp, 'close');
  t.after(deliveryModule.closeEmailTransport);
  await deliveryModule.sendQueuedEmail(message, settings);
  await deliveryModule.sendQueuedEmail({ ...message, id: 2 }, settings);
  assert.equal(factory.mock.callCount(), 1);
  assert.equal((factory.mock.calls[0].arguments[0] as { pool: boolean }).pool, true);
  await deliveryModule.sendQueuedEmail(message, { ...settings, smtpPassword: 'changed-test-password' });
  assert.equal(factory.mock.callCount(), 2); assert.equal(close.mock.callCount(), 1);
  t.mock.method(smtp, 'sendMail', async () => ({ accepted: [] }));
  await assert.rejects(deliveryModule.sendQueuedEmail(message, { ...settings, smtpPassword: 'changed-test-password' }), /did not accept/);
});

test('HTTPS delivery bypasses SMTP and keeps a stable idempotency key on retries', async t => {
  environment(t, { EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'fake-test-key', RESEND_FROM_EMAIL: 'visits@example.test' });
  const smtp = t.mock.method(nodemailer, 'createTransport', () => { throw new Error('SMTP must not run'); });
  const http = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ id: 'provider-message' }), { status: 200 }));
  await deliveryModule.sendQueuedEmail(message, settings);
  await deliveryModule.sendQueuedEmail(message, settings);
  assert.equal(smtp.mock.callCount(), 0);
  const first = http.mock.calls[0].arguments as unknown as [string, RequestInit];
  const second = http.mock.calls[1].arguments as unknown as [string, RequestInit];
  assert.equal(first[0], 'https://api.resend.com/emails');
  assert.equal((first[1].headers as Record<string, string>)['Idempotency-Key'], (second[1].headers as Record<string, string>)['Idempotency-Key']);
  assert.deepEqual(JSON.parse(first[1].body as string).to, [message.to_email]);
  http.mock.mockImplementation(async () => new Response('{}', { status: 429 }));
  await assert.rejects(deliveryModule.sendQueuedEmail(message, settings), /HTTP 429/);
  http.mock.mockImplementation(async () => new Response('{}', { status: 200 }));
  await assert.rejects(deliveryModule.sendQueuedEmail(message, settings), /did not accept/);
  delete process.env.RESEND_API_KEY;
  assert.match(deliveryModule.emailConfigurationError(settings)!, /missing/);
});

test('SMTP sender falls back to the environment login when no sender address is stored', async t => {
  environment(t, { SMTP_USER: 'env-sender@example.test', SMTP_FROM_EMAIL: undefined });
  t.mock.method(db, 'all', async () => []);
  assert.equal((await settingsModule.getNotificationEmailSettings()).fromEmail, 'env-sender@example.test');
});

test('outbox persists delivery, backs off retries, and respects another backend worker lock', async t => {
  environment(t, { EMAIL_PROVIDER: 'smtp' });
  const schema = 'email_test_' + randomUUID().replace(/-/g, '');
  const config = { host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin123', database: 'chms_db', connectionTimeoutMillis: 2000 };
  const local = new Pool(config);
  try { await local.query('SELECT 1'); } catch { await local.end(); t.skip('Local PostgreSQL unavailable'); return; }
  await local.query(`CREATE SCHEMA ${schema}`);
  const store = new Pool({ ...config, options: `-c search_path=${schema}` });
  try {
    const migration = fs.readFileSync(path.join(__dirname, '../db/migrations/007_notifications.sql'), 'utf8');
    await store.query(migration.slice(migration.indexOf('-- Email is queued'), migration.indexOf('-- Initial recipient')));
    await store.query(fs.readFileSync(path.join(__dirname, '../db/migrations/016_email_retry_schedule.sql'), 'utf8'));
    t.mock.method(db.pool, 'connect', () => store.connect());
    let activeSettings = settings;
    t.mock.method(settingsModule, 'getNotificationEmailSettings', async () => activeSettings);
    const sent: number[] = [];
    const send = t.mock.method(deliveryModule, 'sendQueuedEmail', async (item: deliveryModule.QueuedEmail) => { sent.push(item.id); });
    const insert = async () => {
      const log = await store.query("INSERT INTO notification_log (event_type,event_key,channel,recipient,status) VALUES ('test',$1,'email','visitor@example.test','queued') RETURNING id", [randomUUID()]);
      return (await store.query("INSERT INTO email_outbox (to_email,subject,body_html,notification_log_id) VALUES ('visitor@example.test','Visit','<p>Welcome</p>',$1) RETURNING id", [log.rows[0].id])).rows[0].id as number;
    };
    const first = await insert();
    await processEmailOutbox();
    assert.deepEqual(sent, [first]);
    assert.equal((await store.query('SELECT status FROM email_outbox WHERE id=$1', [first])).rows[0].status, 'sent');
    const failed = await insert();
    send.mock.mockImplementation(async () => { throw new Error('Simulated timeout'); });
    await processEmailOutbox();
    const failure = (await store.query('SELECT status,attempts,next_attempt_at > CURRENT_TIMESTAMP AS delayed FROM email_outbox WHERE id=$1', [failed])).rows[0];
    assert.equal(failure.status, 'failed'); assert.equal(failure.attempts, 1); assert.equal(failure.delayed, true);
    const calls = send.mock.callCount(); await processEmailOutbox(); assert.equal(send.mock.callCount(), calls);
    send.mock.mockImplementation(async item => { sent.push(item.id); });
    await store.query('UPDATE email_outbox SET next_attempt_at=CURRENT_TIMESTAMP WHERE id=$1', [failed]);
    await processEmailOutbox(); assert.ok(sent.includes(failed));
    const pending = await insert();
    const holder = await store.connect();
    try {
      await holder.query('SELECT pg_advisory_lock(4476995, 1)');
      await processEmailOutbox(); assert.ok(!sent.includes(pending));
    } finally { await holder.query('SELECT pg_advisory_unlock(4476995, 1)'); holder.release(); }
    await processEmailOutbox(); assert.ok(sent.includes(pending));
    const missing = await insert(); activeSettings = { ...settings, smtpPassword: '' };
    await processEmailOutbox();
    const noConfiguration = (await store.query('SELECT status,attempts FROM email_outbox WHERE id=$1', [missing])).rows[0];
    assert.equal(noConfiguration.status, 'failed'); assert.equal(noConfiguration.attempts, 0);
    activeSettings = settings; await store.query('UPDATE email_outbox SET next_attempt_at=CURRENT_TIMESTAMP WHERE id=$1', [missing]);
    await processEmailOutbox(); assert.ok(sent.includes(missing));
  } finally {
    t.mock.restoreAll(); await store.end(); await local.query(`DROP SCHEMA ${schema} CASCADE`); await local.end();
  }
});

after(async () => { deliveryModule.closeEmailTransport(); await db.pool.end(); });

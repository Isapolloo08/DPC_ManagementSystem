import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import router, { visitSubmissionLimiter } from './plannedVisits';
import { db } from '../db/schema';
import { JWT_SECRET } from '../middleware/auth';
import { validateVisit, manilaToday } from '../services/plannedVisits';
import { visitFollowUp, visitConfirmationEmail } from '../services/visitConfirmation';
import * as emailWorker from '../services/emailOutboxWorker';

const futureSunday = '2099-01-04';
const valid = () => ({ submission_token: randomUUID(), visit_date: futureSunday, party: 'Just me', bringing_children: false, child_age_groups: [], full_name: 'Test Visitor', email: 'visitor@example.test', phone: '', questions: '', consent: true, website: '' });
test('visit validation handles contact options, dates, ages and Manila boundaries', () => {
  for (const contact of [{ email: 'visitor@example.test', phone: '' }, { email: '', phone: '+63 917 123 4567' }, { email: 'visitor@example.test', phone: '09171234567' }]) assert.deepEqual(validateVisit({ ...valid(), ...contact }).errors, {});
  for (const bad of [{ email: '', phone: '' }, { full_name: '' }, { email: 'bad' }, { phone: 'abc' }, { visit_date: '2026-02-30' }, { visit_date: '2099-01-05' }, { visit_date: '2007-01-07' }, { consent: false }, { child_age_groups: ['Invalid'] }, { questions: 'x'.repeat(2001) }, { bringing_children: 'yes' }]) assert.ok(Object.keys(validateVisit({ ...valid(), ...bad }).errors).length);
  assert.equal(manilaToday(new Date('2026-10-10T16:00:00Z')), '2026-10-11');
  assert.deepEqual(validateVisit({ ...valid(), bringing_children: false, child_age_groups: ['Under 3'] }).data.child_age_groups, []);
});

test('confirmation includes the visit schedule, escapes names, and handles Saturday/Sunday in Manila', () => {
  const data = validateVisit({ ...valid(), full_name: '<img src=x onerror=alert(1)>', visit_date: '2026-10-11' }).data;
  for (const submittedAt of ['2026-10-08T09:00:00Z', '2026-10-10T15:59:59Z']) {
    const followUp = visitFollowUp(data.visit_date, submittedAt);
    assert.equal(followUp.date, '2026-10-10');
    assert.match(followUp.message, /Saturday, October 10, 2026/);
  }
  const sunday = visitFollowUp(data.visit_date, '2026-10-10T16:00:00Z');
  assert.equal(sunday.date, null); assert.match(sunday.message, /as soon as possible/);
  assert.equal(visitFollowUp('2026-10-18', '2026-10-11T03:00:00Z').date, '2026-10-17');
  const email = visitConfirmationEmail(data, { receipt_id: randomUUID(), payload_hash: '', created_at: '2026-10-08T09:00:00Z' });
  assert.match(email.html, /Sunday, October 11, 2026/);
  assert.match(email.html, /10:00 AM–11:30 AM/); assert.match(email.html, /9:30 AM/);
  assert.match(email.html, /Saturday, October 10, 2026/);
  assert.ok(!email.html.includes('<img')); assert.match(email.html, /&lt;img/);
});

// Real persistence in a temporary local schema only; never initialize or change production tables.
test('HTTP submission, PostgreSQL persistence, retries, staff permissions and auditing', async t => {
  const delivery = t.mock.method(emailWorker, 'processEmailOutbox', async () => {});
  const schema = 'visit_test_' + randomUUID().replace(/-/g, '');
  const local = new Pool({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin123', database: 'chms_db', connectionTimeoutMillis: 2000 });
  try { await local.query('SELECT 1'); } catch { await local.end(); t.skip('Local PostgreSQL test connection unavailable'); return; }
  await local.query(`CREATE SCHEMA ${schema}`);
  const store = new Pool({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin123', database: 'chms_db', options: `-c search_path=${schema}` });
  const original = { get: db.get, all: db.all, transaction: db.transaction };
  let failSave = false;
  let failEmail = false;
  const app = express(); app.use(express.json()); app.use('/api/planned-visits', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/planned-visits`;
  try {
    await store.query(fs.readFileSync(path.join(__dirname, '../db/migrations/014_planned_visits.sql'), 'utf8'));
    const notifications = fs.readFileSync(path.join(__dirname, '../db/migrations/007_notifications.sql'), 'utf8');
    await store.query(notifications.slice(notifications.indexOf('-- Email is queued'), notifications.indexOf('-- Initial recipient')));
    await store.query(`CREATE TABLE roles (id INT, name TEXT); CREATE TABLE users (id INT, name TEXT, email TEXT, role_id INT); CREATE TABLE user_ministries (user_id INT, ministry_id INT); CREATE TABLE audit_logs (user_id INT, action TEXT, target_table TEXT, target_id INT, details TEXT); INSERT INTO roles VALUES (1,'Admin'),(2,'Pastor'),(3,'Coordinator'),(4,'Leader'); INSERT INTO users VALUES (1,'Admin','admin@example.test',1),(2,'Pastor','pastor@example.test',2),(3,'Coordinator','coordinator@example.test',3),(4,'Leader','leader@example.test',4);`);
    db.get = (async (sql: string, params: any[]) => { if (failSave && sql.includes('INSERT INTO planned_visits')) throw Error('Simulated outage'); return (await store.query(sql, params)).rows[0] || null; }) as any;
    db.all = (async (sql: string, params: any[]) => (await store.query(sql, params)).rows) as any;
    db.transaction = async callback => {
      const client = await store.connect();
      const query = client.query.bind(client);
      client.query = ((sql: string, params: unknown[]) => {
        if (failSave && sql.includes('INSERT INTO planned_visits')) throw Error('Simulated outage');
        if (failEmail && sql.includes('INSERT INTO email_outbox')) throw Error('Simulated queue failure');
        return query(sql, params);
      }) as typeof client.query;
      try { await query('BEGIN'); const result = await callback(client); await query('COMMIT'); return result; }
      catch (error) { await query('ROLLBACK'); throw error; }
      finally { client.query = query; client.release(); }
    };
    const auth = (id: number) => ({ Authorization: `Bearer ${jwt.sign({ id }, JWT_SECRET)}` });
    const post = async (body: object, reset = true) => { if (reset) visitSubmissionLimiter.resetKey('127.0.0.1'); return fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); };
    const payload = valid();
    const first = await post(payload); assert.equal(first.status, 201); const receipt = await first.json() as { receipt_id: string; confirmation_email: string; follow_up: { date: string } };
    assert.equal(delivery.mock.callCount(), 1, 'delivery starts immediately after a saved submission');
    assert.deepEqual(Object.keys(receipt).sort(), ['confirmation_email', 'follow_up', 'message', 'receipt_id']);
    assert.equal(receipt.confirmation_email, 'queued'); assert.equal(receipt.follow_up.date, '2099-01-03');
    const duplicate = await post(payload); assert.equal((await duplicate.json() as { receipt_id: string }).receipt_id, receipt.receipt_id);
    const concurrentPayload = valid();
    const concurrent = await Promise.all([post(concurrentPayload), post(concurrentPayload, false)]);
    assert.equal((await concurrent[0].json() as { receipt_id: string }).receipt_id, (await concurrent[1].json() as { receipt_id: string }).receipt_id);
    assert.equal(Number((await store.query('SELECT COUNT(*) FROM planned_visits')).rows[0].count), 2);
    assert.equal(Number((await store.query('SELECT COUNT(*) FROM email_outbox')).rows[0].count), 2);
    const queued = (await store.query('SELECT * FROM email_outbox ORDER BY id LIMIT 1')).rows[0];
    assert.equal(queued.to_email, payload.email); assert.match(queued.body_html, /Saturday, January 3, 2099/);
    await store.query("UPDATE email_outbox SET status='sent' WHERE id=$1", [queued.id]);
    const statusRequest = (token: string = payload.submission_token) => fetch(base + '/confirmation-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_token: token, receipt_id: receipt.receipt_id }) });
    const emailStatus = await statusRequest(); assert.equal(emailStatus.status, 200);
    assert.deepEqual(await emailStatus.json(), { confirmation_email: 'sent' });
    assert.equal(emailStatus.headers.get('cache-control'), 'no-store');
    assert.equal((await statusRequest(randomUUID())).status, 404);
    assert.equal((await statusRequest('bad')).status, 400);
    assert.equal((await (await post(payload)).json() as { confirmation_email: string }).confirmation_email, 'sent');
    await store.query("UPDATE email_outbox SET status='failed' WHERE id=$1", [queued.id]);
    assert.equal((await (await post(payload)).json() as { confirmation_email: string }).confirmation_email, 'failed');
    failEmail = true;
    const queueRetry = valid(); assert.equal((await post(queueRetry)).status, 503);
    assert.equal(Number((await store.query('SELECT COUNT(*) FROM planned_visits')).rows[0].count), 2);
    assert.equal(Number((await store.query('SELECT COUNT(*) FROM notification_log')).rows[0].count), 2);
    failEmail = false;
    assert.equal((await post({ ...payload, full_name: 'Changed' })).status, 409);
    for (const bad of [{ consent: false }, { email: '', phone: '' }, { visit_date: 'bad' }, { website: 'spam' }]) assert.equal((await post({ ...valid(), ...bad })).status, 400);
    failSave = true; const retryPayload = valid(); assert.equal((await post(retryPayload)).status, 503); failSave = false; assert.equal((await post(retryPayload)).status, 201);
    assert.equal((await fetch(base)).status, 401);
    for (const id of [3, 4]) for (const [url, method] of [[base, 'GET'], [base + '/1', 'GET'], [base + '/1', 'PATCH']]) assert.equal((await fetch(url, { method, headers: { ...auth(id), 'Content-Type': 'application/json' }, ...(method === 'PATCH' ? { body: JSON.stringify({ status: 'Visited', staff_notes: '' }) } : {}) })).status, 403);
    for (const id of [1, 2]) assert.equal((await fetch(base, { headers: auth(id) })).status, 200);
    const list = await (await fetch(base + '?page=1&limit=1&status=New&visit_date=' + futureSunday, { headers: auth(1) })).json() as { items: unknown[]; total: number }; assert.equal(list.items.length, 1); assert.equal(list.total, 3);
    assert.equal((await fetch(base + '?limit=-1', { headers: auth(1) })).status, 400);
    const detail = await (await fetch(base + '/1', { headers: auth(1) })).json() as { email: string; consent_at: string }; assert.equal(detail.email, payload.email); assert.ok(detail.consent_at);
    const patch = () => fetch(base + '/1', { method: 'PATCH', headers: { ...auth(2), 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Visited', staff_notes: 'Welcomed in person.' }) });
    assert.equal((await patch()).status, 200);
    assert.equal((await store.query('SELECT status FROM planned_visits WHERE id=1')).rows[0].status, 'Visited');
    assert.equal(Number((await store.query('SELECT COUNT(*) FROM audit_logs')).rows[0].count), 1);
    await store.query("UPDATE planned_visits SET status='New' WHERE id=1");
    await store.query('DROP TABLE audit_logs'); assert.equal((await patch()).status, 500);
    assert.equal((await store.query('SELECT status FROM planned_visits WHERE id=1')).rows[0].status, 'New');
    const beforePhone = Number((await store.query('SELECT COUNT(*) FROM email_outbox')).rows[0].count);
    const phoneOnly = await post({ ...valid(), email: '', phone: '09171234567' }); assert.equal(phoneOnly.status, 201);
    assert.equal((await phoneOnly.json() as { confirmation_email: string }).confirmation_email, 'not_requested');
    assert.equal(Number((await store.query('SELECT COUNT(*) FROM email_outbox')).rows[0].count), beforePhone);
    assert.equal((await post({ ...valid(), phone: '09171234567', bringing_children: true, child_age_groups: ['Ages 3–5'] })).status, 201);
    const pastPayload = { ...valid(), visit_date: '2007-01-07' };
    assert.equal((await post(pastPayload)).status, 400);
    const pastData = validateVisit(pastPayload, '0000-00-00').data;
    const pastReceipt = randomUUID();
    await store.query(`INSERT INTO planned_visits (receipt_id,submission_token,payload_hash,visit_date,party,bringing_children,child_age_groups,full_name,email) VALUES ($1,$2,$3,$4,$5,false,'{}',$6,$7)`, [pastReceipt, pastPayload.submission_token, createHash('sha256').update(JSON.stringify(pastData)).digest('hex'), pastPayload.visit_date, pastPayload.party, pastPayload.full_name, pastPayload.email]);
    assert.equal((await (await post(pastPayload)).json() as { receipt_id: string }).receipt_id, pastReceipt);
    assert.equal((await post(queueRetry)).status, 201);
    visitSubmissionLimiter.resetKey('127.0.0.1'); for (let i = 0; i < 5; i++) assert.equal((await post(valid(), false)).status, 201); assert.equal((await post(valid(), false)).status, 429);
  } finally {
    Object.assign(db, original); await new Promise<void>(resolve => server.close(() => resolve())); await store.end(); await local.query(`DROP SCHEMA ${schema} CASCADE`); await local.end();
  }
});
after(async () => { await db.pool.end(); });

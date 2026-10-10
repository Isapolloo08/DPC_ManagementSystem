import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import express from 'express';
import { AddressInfo } from 'net';
import router from './eventInvitations';
import { db } from '../db/schema';
import eventsRouter from './events';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth';

test('isolated PostgreSQL scopes member search and preserves one RSVP per event across links', async t => {
  // Match the existing local integration fixture. No configured cloud URL or public schema writes.
  const config = { host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin123', database: 'chms_db', connectionTimeoutMillis: 2000 };
  const admin = new Pool(config);
  try { await admin.query('SELECT 1'); } catch { await admin.end(); t.skip('Local PostgreSQL fixture unavailable'); return; }
  const schema = 'invitation_test_' + randomUUID().replace(/-/g, '');
  assert.match(schema, /^invitation_test_[a-f0-9]{32}$/);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ ...config, options: `-c search_path=${schema}` });
  const original = { get: db.get, all: db.all, run: db.run, transaction: db.transaction };
  const app = express(); app.use(express.json()); app.use('/invitations', router); app.use('/events', eventsRouter);
  const server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/invitations/public/`;
  const a = 'a'.repeat(64), b = 'b'.repeat(64), c = 'c'.repeat(64);
  try {
    const migration = (name: string) => fs.readFileSync(path.join(__dirname, '../db/migrations', name), 'utf8');
    await pool.query(migration('001_init_postgres.sql'));
    await pool.query(migration('020_event_invitations.sql'));
    await pool.query("INSERT INTO ministries (id, name) VALUES (501, 'Youth'), (502, 'Adults')");
    await pool.query("INSERT INTO members (id, first_name, last_name, birthdate, ministry_id, status) VALUES (501,'Juan','Santos','2000-01-01',501,'active'), (502,'Juan','Reyes','1980-01-01',502,'active'), (503,'Juan','Inactive','2000-01-01',501,'inactive')");
    await pool.query("INSERT INTO events (id, title, ministry_id, start_time, end_time) VALUES (501,'Youth Fellowship',501,'2099-01-02','2099-01-03'), (502,'All Church',NULL,'2099-01-02','2099-01-03')");
    await pool.query("INSERT INTO event_invitation_links (id, event_id, member_id, token, deadline) VALUES (501,501,NULL,$1,'2099-01-01'), (502,501,501,$2,'2099-01-01'), (503,502,NULL,$3,'2099-01-01')", [a, b, c]);
    await pool.query("INSERT INTO event_invitation_responses (invitation_id, response_key, name, answer) VALUES (502,'member','Juan Santos','maybe')");
    await pool.query(migration('021_invitation_member_responses.sql'));
    await pool.query(migration('022_event_ministries.sql'));
    await pool.query(migration('021_invitation_member_responses.sql'));
    assert.deepEqual((await pool.query('SELECT event_id, member_id FROM event_invitation_responses')).rows, [{ event_id: 501, member_id: 501 }]);
    db.get = (async (query: string, params: any[]) => (await pool.query(query, params)).rows[0]) as any;
    db.all = (async (query: string, params: any[]) => (await pool.query(query, params)).rows) as any;
    db.run = (async (query: string, params: any[]) => { const result = await pool.query(query, params); return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id }; }) as any;
    db.transaction = (async (callback: any) => {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result; }
      catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }) as any;
    const search = (token: string) => fetch(base + token + '/members?search=J').then(response => response.json());
    assert.deepEqual(await search(a), { members: [{ id: 501, name: 'Juan Santos' }] });
    assert.deepEqual(await search(c), { members: [{ id: 502, name: 'Juan Reyes' }, { id: 501, name: 'Juan Santos' }] });
    const post = (token: string, body: any) => fetch(base + token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const member = { attendeeType: 'member', member_id: 501, name: 'Forged name', answer: 'yes' };
    assert.equal((await post(a, { ...member, member_id: 502 })).status, 400);
    assert.equal((await post(a, { ...member, member_id: 503 })).status, 400);
    assert.equal((await post(a, member)).status, 200);
    assert.deepEqual((await pool.query('SELECT name, answer, member_id FROM event_invitation_responses')).rows, [{ name: 'Juan Santos', answer: 'yes', member_id: 501 }]);
    assert.equal((await pool.query('SELECT status FROM event_registrations')).rows[0].status, 'registered');
    assert.equal((await post(b, { answer: 'no', reason: 'Working' })).status, 200);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM event_invitation_responses')).rows[0].count, 1);
    assert.equal((await pool.query('SELECT status FROM event_registrations')).rows[0].status, 'cancelled');
    await pool.query("UPDATE event_registrations SET status='attended'");
    assert.equal((await post(a, { ...member, answer: 'maybe' })).status, 200);
    assert.equal((await pool.query('SELECT status FROM event_registrations')).rows[0].status, 'attended');
    assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM attendance')).rows[0].count, 0);
    // A collaborative event includes both active ministries, but still excludes inactive members.
    await pool.query('INSERT INTO event_ministries(event_id,ministry_id) VALUES (501,502)');
    assert.deepEqual(await search(a), { members: [{ id: 502, name: 'Juan Reyes' }, { id: 501, name: 'Juan Santos' }] });
    assert.equal((await post(a, { ...member, member_id: 502 })).status, 200);
    await pool.query("INSERT INTO roles(id,name) VALUES (501,'Admin')");
    await pool.query("INSERT INTO users(id,name,email,password_hash,role_id) VALUES (501,'Test Admin','fixture@example.test','test',501)");
    const eventBase = base.replace('/invitations/public/', '/events');
    const auth = { Authorization: 'Bearer ' + jwt.sign({ id: 501 }, JWT_SECRET), 'Content-Type': 'application/json' };
    const mutate = (url: string, body: any, method = 'POST') => fetch(eventBase + url, { method, headers: auth, body: JSON.stringify(body) });
    const created = await mutate('', { title: 'Youth + Adults', ministry_ids: [501, 502], start_time: '2099-10-05', end_time: '2099-10-06' });
    assert.equal(created.status, 201); const createdId = (await created.json() as any).id;
    const fromSecond = await fetch(eventBase + '?ministry_id=502').then(response => response.json()) as any[];
    assert.deepEqual(fromSecond.find(event => event.id === createdId).ministry_ids, [501, 502]);
    assert.equal(fromSecond.find(event => event.id === createdId).ministry_name, 'Youth + Adults');
    assert.equal((await mutate('/' + createdId, { ministry_ids: [502] }, 'PUT')).status, 200);
    assert.deepEqual((await fetch(eventBase + '/' + createdId).then(response => response.json()) as any).ministry_ids, [502]);
    assert.equal((await mutate('/' + createdId, { description: 'Preserve targets' }, 'PUT')).status, 200);
    assert.deepEqual((await fetch(eventBase + '/' + createdId).then(response => response.json()) as any).ministry_ids, [502]);
    assert.equal((await mutate('', { title: 'Invalid targets', ministry_ids: [999999], start_time: '2099-10-05', end_time: '2099-10-06' })).status, 400);
    const recurringResponse = await mutate('/recurring-sunday-cycle', { title: 'Joint Annual Celebration', month: 10, ministry_ids: [501, 502] });
    assert.equal(recurringResponse.status, 201); const recurringId = (await recurringResponse.json() as any).id;
    const synced = await mutate(`/recurring-sunday-cycle/${recurringId}/sync-to-calendar`, { year: 2099 });
    assert.equal(synced.status, 200); const syncedId = (await synced.json() as any).event_id;
    assert.deepEqual((await fetch(eventBase + '/' + syncedId).then(response => response.json()) as any).ministry_ids, [501, 502]);
    assert.equal((await mutate(`/recurring-sunday-cycle/${recurringId}`, { ministry_ids: [] }, 'PUT')).status, 200);
    const recurringRows = await fetch(eventBase + '/recurring-sunday-cycle?year=2099&ministry_id=502').then(response => response.json()) as any;
    assert.deepEqual(recurringRows.events.find((event: any) => event.id === recurringId).ministry_ids, []);
    await pool.query('UPDATE event_invitation_links SET enabled=false WHERE id=501');
    assert.equal((await fetch(base + a + '/members?search=J')).status, 410);
  } finally {
    Object.assign(db, original);
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});

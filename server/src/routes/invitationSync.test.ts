import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'net';
import router from './invitationSync';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { db } from '../db/schema';
import { JWT_SECRET } from '../middleware/auth';

test('Admin can inspect readiness while Pastor cannot access pending submissions', async t => {
  const config = { host:'127.0.0.1', port:5432, user:'postgres', password:'admin123', database:'chms_db', connectionTimeoutMillis:2000 };
  const admin = new Pool(config);
  try { await admin.query('SELECT 1'); } catch { await admin.end(); t.skip('Local PostgreSQL fixture unavailable'); return; }
  const schema = 'sync_test_' + randomUUID().replace(/-/g,'');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ ...config, options:`-c search_path=${schema}` });
  const original = { get:db.get, all:db.all, run:db.run, transaction:db.transaction };
  const app = express(); app.use(express.json()); app.use('/sync',router);
  const server=app.listen(0); await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/sync`;
  try {
    for (const name of ['001_init_postgres.sql','007_notifications.sql','020_event_invitations.sql','021_invitation_member_responses.sql','023_invitation_sync.sql']) await pool.query(fs.readFileSync(path.join(__dirname,'../db/migrations',name),'utf8'));
    await pool.query("INSERT INTO roles(id,name) VALUES(501,'Admin'),(502,'Pastor'); INSERT INTO users(id,name,email,password_hash,role_id) VALUES(501,'Admin','admin@example.test','test',501),(502,'Pastor','pastor@example.test','test',502)");
    db.get=(async(q:string,p:any[]) => (await pool.query(q,p)).rows[0]) as any;
    db.all=(async(q:string,p:any[]) => (await pool.query(q,p)).rows) as any;
    db.run=(async(q:string,p:any[]) => {const r=await pool.query(q,p);return {changes:r.rowCount,lastInsertRowid:r.rows[0]?.id};}) as any;
    const headers=(id:number)=>({Authorization:'Bearer '+jwt.sign({id},JWT_SECRET)});
    assert.equal((await fetch(base+'/state',{headers:headers(502)})).status,403);
    const response=await fetch(base+'/state',{headers:headers(501)});
    assert.equal(response.status,200);
    const state=await response.json() as any;
    assert.equal(state.state,'Not paired'); assert.equal(state.credential,undefined); assert.equal(state.pending.length,0);
  } finally {
    Object.assign(db,original); await new Promise<void>(r=>server.close(()=>r())); await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  }
});

test('submission synchronization rejects unauthenticated local and integration requests', async () => {
  const app = express(); app.use(express.json()); app.use('/sync', router);
  const server = app.listen(0); await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/sync`;
  try {
    for (const path of ['/state', '/source/metadata']) assert.equal((await fetch(base + path)).status, 401);
  } finally { await new Promise<void>(r => server.close(() => r())); }
});

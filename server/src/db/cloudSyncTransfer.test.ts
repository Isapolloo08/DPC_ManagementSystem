import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { Pool } from "pg";
import express from "express";
import jwt from "jsonwebtoken";
import { transferTables, SyncSql } from "./cloudSyncTransfer";
import { SYNC_TABLES } from "./cloudSyncService";
import { db, pool } from "./schema";
import { requestTimeout } from "../middleware/requestTimeout";
import cloudSyncRouter from "../routes/cloudSync";
import { JWT_SECRET } from "../middleware/auth";

const migration = (name: string) => fs.readFileSync(path.join(__dirname, "migrations", name), "utf8");
const compatibility = () => migration("015_cloud_sync_columns.sql");
const localConfig = { host: "127.0.0.1", port: 5432, user: "postgres", password: "admin123", database: "chms_db", connectionTimeoutMillis: 2000 };

// All writes, schema changes and cleanup are restricted to unique test schemas
// on local PostgreSQL. This suite never uses configured cloud credentials.
test("cloud transfers preserve identities, schema fields and atomic failure behavior", async t => {
  const admin = new Pool(localConfig);
  try { await admin.query("SELECT 1"); } catch { await admin.end(); t.skip("Local PostgreSQL test connection unavailable"); return; }
  const sourceSchema = "sync_source_" + randomUUID().replace(/-/g, "");
  const targetSchema = "sync_target_" + randomUUID().replace(/-/g, "");
  await admin.query(`CREATE SCHEMA ${sourceSchema}; CREATE SCHEMA ${targetSchema}`);
  const sourcePool = new Pool({ ...localConfig, options: `-c search_path=${sourceSchema}` });
  const target = postgres("postgres://postgres:admin123@127.0.0.1:5432/chms_db", {
    max: 1, prepare: false, connection: { search_path: targetSchema }, onnotice: () => {}
  });
  const source: SyncSql = { unsafe: async (query, params) => (await sourcePool.query(query, params)).rows };
  const inSourceTransaction = async (callback: (tx: SyncSql) => Promise<any>) => {
    const client = await sourcePool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback({ unsafe: async (q, p) => (await client.query(q, p)).rows });
      await client.query("COMMIT"); return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  };
  const push = (progress?: any, signal?: AbortSignal) => target.begin(async tx => {
    await tx.unsafe(compatibility());
    return inSourceTransaction(async readTx => {
      await readTx.unsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await readTx.unsafe("SET LOCAL statement_timeout = '30s'");
      return transferTables(readTx, tx as any, SYNC_TABLES, "push", progress, signal);
    });
  });
  const pull = () => inSourceTransaction(tx => target.begin(async readTx => {
    await readTx.unsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await readTx.unsafe("SET LOCAL statement_timeout = '30s'");
    return transferTables(readTx as any, tx, SYNC_TABLES, "pull");
  }));
  try {
    await source.unsafe(migration("001_init_postgres.sql"));
    await target.unsafe(migration("001_init_postgres.sql"));
    await source.unsafe(migration("005_service_calendar_and_attendance_intelligence.sql"));
    await target.unsafe(migration("005_service_calendar_and_attendance_intelligence.sql"));
    await source.unsafe(migration("008_group_transitions.sql"));
    await target.unsafe(migration("008_group_transitions.sql"));
    await source.unsafe(migration("010_make_user_email_optional.sql"));
    await target.unsafe(migration("010_make_user_email_optional.sql"));
    await source.unsafe(compatibility());
    await source.unsafe("ALTER TABLE households ADD COLUMN family_members JSONB NOT NULL DEFAULT '[]'::jsonb");
    await target.unsafe("ALTER TABLE households ADD COLUMN family_members JSONB NOT NULL DEFAULT '[]'::jsonb");
    await source.unsafe(`
      INSERT INTO roles (id,name) VALUES (1,'Admin'),(3,'Coordinator'),(7,'Leader');
      INSERT INTO ministries (id,name) VALUES (1,'Youth');
      INSERT INTO users (id,name,username,email,password_hash,role_id,bible_language,reading_start) VALUES
        (1,'New Account','new','new@example.test','hash',1,'tl','2026-09-01'),
        (2,'Existing Account','existing','existing@example.test','updated-hash',3,'tl','2026-09-02'),
        (3,'No Email','no-email',NULL,'hash',7,'en','2026-09-03');
      INSERT INTO user_ministries (id,user_id,ministry_id) VALUES (1,1,1),(2,2,1),(3,3,1);
      INSERT INTO households (id,name,family_members) VALUES (1,'Test Household','[{"name":"Child"}]');
      INSERT INTO members (id,first_name,last_name,birthdate,gender,ministry_id,user_id,household_id) VALUES (1,'Test','Member','2000-01-01','Female',1,2,1);
      INSERT INTO bible_study_groups (id,name,leader_name,leader_user_id,meeting_day,meeting_time,location) VALUES (1,'Test Group','Leader',2,'Sunday','10:00','Church');
      INSERT INTO bible_study_group_transitions (id,transition_type,new_group_id,effective_date,created_by) VALUES (1,'merge',1,'2026-10-01',2);
      INSERT INTO bible_study_group_transition_sources (id,transition_id,source_group_id) VALUES (1,1,1);
      INSERT INTO bible_study_members (id,group_id,member_id,transition_id) VALUES (1,1,1,1);
      INSERT INTO dishwashing_roster (id,duty_date,assigned_name,biblestudy_group_id) VALUES (1,'2026-10-11','Test Group',1);
      INSERT INTO system_settings (key,value) VALUES ('church_name','Test Church'),('cloud_database_url','source-secret'),('cloud_last_synced_at','source-history');
    `);
    await target.unsafe(`
      INSERT INTO roles (id,name) VALUES (1,'Admin'),(4,'Coordinator'),(3,'Leader');
      INSERT INTO ministries (id,name) VALUES (1,'Youth');
      INSERT INTO users (id,name,username,email,password_hash,role_id) VALUES
        (1,'Existing Account','existing','existing@example.test','old-hash',4),
        (2,'Cloud Only','cloud-only','cloud-only@example.test','hash',1),
        (5,'No Email','no-email',NULL,'old-hash',3);
      INSERT INTO user_ministries (id,user_id,ministry_id) VALUES (1,2,1);
      INSERT INTO system_settings (key,value) VALUES ('cloud_database_url','target-secret'),('cloud_last_synced_at','target-history');
    `);

    await t.test("additive migration, ID collisions, nullable emails, foreign keys, JSON and retry", async () => {
      const result = await push();
      assert.equal(result.syncedTables, SYNC_TABLES.length);
      assert.equal(result.totalRows, 18);
      const users = await target.unsafe("SELECT * FROM users ORDER BY id");
      assert.equal(users.length, 4);
      const existing = users.find(u => u.username === "existing")!;
      const newAccount = users.find(u => u.username === "new")!;
      assert.equal(existing.id, 1); assert.equal(existing.role_id, 4);
      assert.equal(existing.bible_language, "tl"); assert.equal(existing.password_hash, "updated-hash");
      assert.equal(users.find(u => u.username === "no-email")!.role_id, 3);
      assert.ok(newAccount.id > 5);
      assert.equal((await target.unsafe("SELECT user_id FROM members WHERE id=1"))[0].user_id, 1);
      assert.equal((await target.unsafe("SELECT leader_user_id FROM bible_study_groups WHERE id=1"))[0].leader_user_id, 1);
      assert.equal((await target.unsafe("SELECT created_by FROM bible_study_group_transitions WHERE id=1"))[0].created_by, 1);
      assert.equal((await target.unsafe("SELECT transition_id FROM bible_study_members WHERE id=1"))[0].transition_id, 1);
      assert.deepEqual((await target.unsafe("SELECT family_members FROM households WHERE id=1"))[0].family_members, [{ name: "Child" }]);
      const memberships = await target.unsafe("SELECT user_id FROM user_ministries ORDER BY user_id");
      assert.deepEqual(memberships.map(r => r.user_id), [1, 2, 5, newAccount.id]);
      assert.equal((await target.unsafe("SELECT value FROM system_settings WHERE key='cloud_database_url'"))[0].value, "target-secret");
      assert.equal((await target.unsafe("SELECT value FROM system_settings WHERE key='cloud_last_synced_at'"))[0].value, "target-history");
      await source.unsafe("UPDATE users SET bible_language='en' WHERE id=2");
      await push();
      assert.equal((await target.unsafe("SELECT bible_language FROM users WHERE id=1"))[0].bible_language, "en");
      assert.equal(Number((await target.unsafe("SELECT COUNT(*) AS count FROM user_ministries"))[0].count), 4);
    });

    await t.test("pull remaps cloud identities back to local accounts", async () => {
      await pull();
      assert.equal((await source.unsafe("SELECT role_id FROM users WHERE id=2"))[0].role_id, 3);
      assert.equal((await source.unsafe("SELECT user_id FROM members WHERE id=1"))[0].user_id, 2);
      assert.equal((await source.unsafe("SELECT leader_user_id FROM bible_study_groups WHERE id=1"))[0].leader_user_id, 2);
      assert.equal((await source.unsafe("SELECT created_by FROM bible_study_group_transitions WHERE id=1"))[0].created_by, 2);
      assert.deepEqual((await source.unsafe("SELECT family_members FROM households WHERE id=1"))[0].family_members, [{ name: "Child" }]);
      assert.equal((await source.unsafe("SELECT value FROM system_settings WHERE key='cloud_database_url'"))[0].value, "source-secret");
    });

    await t.test("unknown schema drift fails before data writes", async () => {
      await source.unsafe("ALTER TABLE users ADD COLUMN future_preference TEXT");
      await assert.rejects(push(), /users.future_preference missing on destination/);
      await source.unsafe("ALTER TABLE users DROP COLUMN future_preference");
    });

    await t.test("batches preserve self-references to later batches and circular spouses", async () => {
      await source.unsafe(`INSERT INTO members (id,first_name,last_name,birthdate,gender)
        SELECT id,'Batch','Member','2000-01-01','Male' FROM generate_series(2,205) id;
        UPDATE members SET spouse_id=205 WHERE id=1;
        UPDATE members SET spouse_id=1 WHERE id=205`);
      await push();
      assert.equal(Number((await target.unsafe("SELECT COUNT(*) AS count FROM members"))[0].count), 205);
      assert.equal((await target.unsafe("SELECT spouse_id FROM members WHERE id=1"))[0].spouse_id, 205);
      assert.equal((await target.unsafe("SELECT spouse_id FROM members WHERE id=205"))[0].spouse_id, 1);
      await pull();
      assert.equal((await source.unsafe("SELECT spouse_id FROM members WHERE id=1"))[0].spouse_id, 205);
    });

    await t.test("ambiguous account identifiers roll back instead of merging accounts", async () => {
      await target.unsafe("UPDATE users SET username='ambiguous' WHERE id=2");
      await source.unsafe("UPDATE users SET username='ambiguous' WHERE id=2");
      await assert.rejects(push(), /identity conflict in users/);
      assert.equal((await target.unsafe("SELECT username FROM users WHERE id=1"))[0].username, "existing");
      await source.unsafe("UPDATE users SET username='existing' WHERE id=2");
      await target.unsafe("UPDATE users SET username='cloud-only' WHERE id=2");
    });

    await t.test("a foreign key failure rolls back previous tables and preserves attribution", async () => {
      await source.unsafe("UPDATE users SET bible_language='tl' WHERE id=2");
      await source.unsafe(`ALTER TABLE events DROP CONSTRAINT events_created_by_fkey;
        INSERT INTO events (id,title,start_time,end_time,created_by) VALUES (1,'Orphan Event',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,99999)`);
      await assert.rejects(push(), /failed in events.*23503.*No transfer was committed/);
      assert.equal((await target.unsafe("SELECT bible_language FROM users WHERE id=1"))[0].bible_language, "en");
      assert.equal(Number((await target.unsafe("SELECT COUNT(*) AS count FROM events"))[0].count), 0);
      await source.unsafe("DELETE FROM events WHERE id=1");
    });

    await t.test("cancellation rolls back rows and additive schema changes", async () => {
      await target.unsafe("ALTER TABLE users DROP COLUMN bible_language");
      const controller = new AbortController();
      await assert.rejects(push((progress: { step: string; message: string }) => {
        if (progress.step === "users" && progress.message.startsWith("Uploaded")) controller.abort();
      }, controller.signal), /client disconnected.*No transfer was committed/);
      const columns = await target.unsafe("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users'");
      assert.ok(!columns.some(c => c.column_name === "bible_language"));
      await push();
    });
  } finally {
    await target.end({ timeout: 2 }); await sourcePool.end();
    await admin.query(`DROP SCHEMA ${sourceSchema} CASCADE; DROP SCHEMA ${targetSchema} CASCADE`);
    await admin.end();
  }
});

test("only cloud transfers bypass the short HTTP socket timeout", () => {
  for (const [method, requestPath, expected] of [
    ["POST", "/api/cloud-sync/push", 0], ["POST", "/api/cloud-sync/pull/", 0],
    ["POST", "/api/cloud-sync/push?unused", 60000], ["GET", "/api/cloud-sync/status", 60000],
    ["GET", "/api/members", 15000], ["POST", "/api/members", 15000]
  ] as const) {
    let actual = -1; let nextCalled = false;
    requestTimeout({ method, path: requestPath } as any, { setTimeout: (ms: number) => { actual = ms; } } as any, () => { nextCalled = true; });
    assert.equal(actual, expected); assert.ok(nextCalled);
  }
});

test("HTTP sync keeps permissions, rejects overlapping transfers and cancels a disconnected client", async () => {
  // This HTTP test mocks the account lookup and transfer; persistence and
  // rollback are covered above with real PostgreSQL.
  const service = require("./cloudSyncService") as typeof import("./cloudSyncService");
  const original = { get: db.get, all: db.all, push: service.pushLocalToCloud };
  db.get = (async (_q: string, params: number[]) => ({ id: params[0], name: "Test User",
    email: "test@example.test", role_id: params[0], role_name: params[0] === 1 ? "Admin" : "Coordinator" })) as any;
  db.all = (async () => []) as any;
  const result = { success: true, totalRows: 1, syncedTables: 1, message: "Test transfer committed" };
  let ready: () => void;
  let release: () => void;
  let transferSignal: AbortSignal;
  let stopped: () => void;
  service.pushLocalToCloud = ((_name, _progress, signal) => new Promise((resolve, reject) => {
    transferSignal = signal!;
    release = () => resolve(result);
    signal!.addEventListener("abort", () => { reject(new Error("Test client disconnected")); stopped?.(); }, { once: true });
    ready();
  })) as typeof service.pushLocalToCloud;
  const app = express(); app.use(requestTimeout); app.use("/api/cloud-sync", cloudSyncRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/cloud-sync`;
  const auth = (id: number) => ({ Authorization: `Bearer ${jwt.sign({ id }, JWT_SECRET)}` });
  try {
    assert.equal((await fetch(base + "/push", { method: "POST" })).status, 401);
    assert.equal((await fetch(base + "/push", { method: "POST", headers: auth(2) })).status, 403);
    const started = new Promise<void>(resolve => { ready = resolve; });
    const first = fetch(base + "/push", { method: "POST", headers: auth(1) });
    await started;
    assert.equal((await fetch(base + "/pull", { method: "POST", headers: auth(1) })).status, 409);
    assert.equal(transferSignal!.aborted, false);
    release!(); assert.equal((await first).status, 200);

    const controller = new AbortController();
    const secondStarted = new Promise<void>(resolve => { ready = resolve; });
    const aborted = new Promise<void>(resolve => { stopped = resolve; });
    const second = fetch(base + "/push", { method: "POST", headers: auth(1), signal: controller.signal });
    const rejection = assert.rejects(second, { name: "AbortError" });
    await secondStarted; controller.abort(); await rejection; await aborted;
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(transferSignal!.aborted, true);
    service.pushLocalToCloud = (async () => result) as typeof service.pushLocalToCloud;
    assert.equal((await fetch(base + "/push", { method: "POST", headers: auth(1) })).status, 200);
  } finally {
    service.pushLocalToCloud = original.push; db.get = original.get; db.all = original.all;
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

after(async () => { await pool.end(); });

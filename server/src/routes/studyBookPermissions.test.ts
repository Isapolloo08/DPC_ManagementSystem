import assert from "node:assert/strict";
import { test } from "node:test";
import topics from "./studyTopics";
import groups from "./groups";
import { db } from "../db/schema";
import * as studyNotifications from "../services/bibleStudyNotifications";

test("book creation, editing and deletion are limited to coordinators, pastors and administrators", () => {
  for (const [method, path] of [["post", "/"], ["put", "/:id"], ["delete", "/:id"]]) {
    const layer = (topics as any).stack.find((entry: any) => entry.route?.path === path && entry.route.methods[method]);
    for (const role of ["Leader", "Member", "Volunteer", "Coordinator", "Pastor", "Admin", "IT Admin"]) {
      let status = 200, next = false;
      const res = { status: (value: number) => { status = value; return res; }, json: () => res };
      layer.route.stack[0].handle({ user: { role_name: role } }, res, () => { next = true; });
      const allowed = ["Coordinator", "Pastor", "Admin", "IT Admin"].includes(role);
      assert.equal(next, allowed, `${method} ${role}`);
      assert.equal(status, allowed ? 200 : 403);
    }
  }
});

async function update(role: string, curriculum: unknown, assigned = true, failWrite = false) {
  const original = { get: db.get, run: db.run };
  let bookParameter: unknown = "no write", writes = 0, status = 200;
  const originalNotify = studyNotifications.sendBibleStudyUpdateNotification;
  const notifications: unknown[] = [];
  (studyNotifications as any).sendBibleStudyUpdateNotification = async (groupId: number, options: unknown) => {
    assert.equal(writes, 1);
    notifications.push({ groupId, options });
  };
  db.get = (async (sql: string) => sql === "SELECT * FROM bible_study_groups WHERE id = $1" ? { curriculum: "Romans" }
    : sql.startsWith("SELECT g.id") && assigned ? { id: 11 } : null) as any;
  db.run = (async (sql: string, params: any[] = []) => {
    if (sql.includes("UPDATE bible_study_groups")) { if (failWrite) throw new Error("Update failed"); writes++; bookParameter = params[2]; }
    else assert.match(sql, /INSERT INTO audit_logs/);
    return { changes: 1 };
  }) as any;
  const res = { status: (value: number) => { status = value; return res; }, json: () => res };
  try {
    const layer = (groups as any).stack.find((entry: any) => entry.route?.path === "/:id" && entry.route.methods.put);
    await layer.route.stack.at(-1).handle({ params: { id: "11" }, body: { curriculum, current_chapter: "Chapter 3", progress_stage: "review" }, user: { id: 1, name: "Test Facilitator", role_name: role } }, res);
    return { status, writes, bookParameter, notifications };
  } finally { Object.assign(db, original); (studyNotifications as any).sendBibleStudyUpdateNotification = originalNotify; }
}

test("leaders cannot bypass the locked book through group updates", async () => {
  for (const value of ["Genesis", null, 12]) {
    const result = await update("Leader", value);
    assert.equal(result.status, 403);
    assert.equal(result.writes, 0);
    assert.equal(result.notifications.length, 0);
  }
  const same = await update("Leader", "Romans");
  assert.equal(same.status, 200);
  assert.equal(same.writes, 1);
  assert.equal(same.bookParameter, null); // A progress save never writes a Leader's book, including concurrent reassignment.
  assert.deepEqual(same.notifications, [{ groupId: 11, options: { actorName: "Test Facilitator" } }]);
  assert.equal((await update("Leader", "Romans", false)).status, 403);
});

test("failed progress saves do not notify the Pastor", async () => {
  const result = await update("Leader", "Romans", true, true);
  assert.equal(result.status, 500);
  assert.equal(result.notifications.length, 0);
});

test("coordinators, pastors and administrators can still change the assigned book", async () => {
  for (const role of ["Coordinator", "Pastor", "Admin", "IT Admin"]) {
    const result = await update(role, "Genesis");
    assert.equal(result.status, 200);
    assert.equal(result.bookParameter, "Genesis");
  }
});

test("quick chapter progress uses the shared notification path after saving and enforces group assignment", async () => {
  const original = { get: db.get, all: db.all, run: db.run };
  const originalNotify = studyNotifications.sendBibleStudyUpdateNotification;
  let assigned = true, writes = 0, status = 200;
  const notifications: unknown[] = [];
  db.get = (async (sql: string) => sql === "SELECT * FROM bible_study_groups WHERE id = $1"
    ? { name: "Romans group", curriculum: "Romans", current_chapter: "Chapter 2", progress_stage: "midway", status: "active" }
    : assigned ? { id: 11 } : null) as any;
  db.all = (async () => [{ id: 1, title: "Romans", total_chapters: 16 }]) as any;
  db.run = (async (sql: string) => {
    if (sql.includes("UPDATE bible_study_groups")) writes++;
    else assert.match(sql, /INSERT INTO audit_logs/);
    return { changes: 1 };
  }) as any;
  (studyNotifications as any).sendBibleStudyUpdateNotification = async (groupId: number, options: unknown) => {
    assert.equal(writes, 1);
    notifications.push({ groupId, options });
  };
  const res = { status: (value: number) => { status = value; return res; }, json: () => res };
  try {
    const layer = (groups as any).stack.find((entry: any) => entry.route?.path === "/:id/progress" && entry.route.methods.patch);
    const req = { params: { id: "11" }, body: { current_chapter: "Chapter 3", progress_stage: "review", progress_notes: "Page 18, question 3" }, user: { id: 1, name: "Test Leader", role_name: "Leader" } };
    await layer.route.stack.at(-1).handle(req, res);
    assert.equal(status, 200);
    assert.deepEqual(notifications, [{ groupId: 11, options: { actorName: "Test Leader" } }]);
    assigned = false;
    await layer.route.stack.at(-1).handle(req, res);
    assert.equal(status, 403);
    assert.equal(writes, 1);
    assert.equal(notifications.length, 1);
  } finally { Object.assign(db, original); (studyNotifications as any).sendBibleStudyUpdateNotification = originalNotify; }
});

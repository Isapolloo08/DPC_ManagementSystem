import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { db } from "../db/schema";
import router from "./groups";

test("UTC serialization of a PostgreSQL DATE reproduces the Manila one-day shift", () => {
  const result = spawnSync(process.execPath, ["-e", `
    const parseDate = require('pg').types.getTypeParser(1082);
    const date = parseDate('2026-10-07');
    process.stdout.write(date.toISOString().slice(0, 10));
  `], { env: { ...process.env, TZ: "Asia/Manila" }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "2026-10-06");
});

test("session history returns calendar dates unchanged and aligns attendance with each session", async () => {
  const original = { get: db.get, all: db.all };
  const dates = ["2026-10-07", "2026-09-30"];
  db.get = (async () => ({ id: 11, name: "Romans group", curriculum: "Romans", current_chapter: "Chapter 3" })) as any;
  db.all = (async (sql: string) => {
    if (sql.includes("FROM bible_study_members")) return [{ member_id: 2, first_name: "Grace", last_name: "Reyes" }];
    if (sql.includes("FROM bible_study_sessions s")) {
      // A text projection prevents node-postgres from parsing DATE as local midnight.
      assert.match(sql, /to_char\(s\.session_date, 'YYYY-MM-DD'\) AS session_date/);
      return dates.map((session_date, index) => ({ id: 7 - index, session_date, topic_title: "Romans", chapter: `Chapter ${3 - index}`, progress_stage: "review", recorded_by_name: "Test Leader" }));
    }
    if (sql.includes("FROM bible_study_attendance a")) {
      assert.match(sql, /to_char\(a\.session_date, 'YYYY-MM-DD'\) AS session_date/);
      return dates.map((session_date, index) => ({ member_id: 2, session_date, status: index ? "excused" : "present" }));
    }
    throw new Error("Unexpected query: " + sql);
  }) as any;
  let status = 200, response: any;
  const res = { status: (value: number) => { status = value; return res; }, json: (value: unknown) => { response = value; return res; } };
  try {
    const layer = (router as any).stack.find((entry: any) => entry.route?.path === "/:id/attendance" && entry.route.methods.get);
    await layer.route.stack.at(-1).handle({ params: { id: "11" }, query: {} }, res);
    assert.equal(status, 200);
    assert.deepEqual(response.sessions.map((session: any) => session.session_date), dates);
    assert.deepEqual(response.members[0].history.map((entry: any) => entry.session_date), dates);
    assert.equal(response.sessions[0].present_count, 1);
    assert.equal(response.sessions[0].absent_count, 0);
    assert.equal(response.sessions[1].excused_count, 1);
    assert.equal(response.members[0].present_count, 1);
    assert.equal(response.members[0].excused_count, 1);
  } finally { Object.assign(db, original); }
});

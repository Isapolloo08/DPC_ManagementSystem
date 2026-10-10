import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../db/schema";
import router from "./groups";
import * as studyNotifications from "../services/bibleStudyNotifications";

// Exercise the application handler with an isolated store, without a live database.
async function save(body: Record<string, unknown>, options: { newer?: boolean; failAttendance?: boolean; role?: string; assigned?: boolean; recordedBook?: string; assignedBook?: string | null } = {}) {
  let state = { group: { id: 11, name: "Study group", status: "active", curriculum: (options.assignedBook !== undefined ? options.assignedBook : "Romans") as string | null, current_chapter: "Chapter 2", progress_stage: "midway", progress_notes: "Continue at page 12", meeting_day: "Wednesday" }, sessions: [] as any[], attendance: [] as any[] };
  const original = { get: db.get, all: db.all, run: db.run, transaction: db.transaction };
  const originalNotify = studyNotifications.sendBibleStudyUpdateNotification;
  const notifications: { groupId: number; options: unknown; committed: boolean }[] = [];
  let committed = false;
  (studyNotifications as any).sendBibleStudyUpdateNotification = async (groupId: number, notificationOptions: unknown) => {
    notifications.push({ groupId, options: notificationOptions, committed });
  };
  let transactions = 0;
  db.get = (async (sql: string) => sql === "SELECT * FROM bible_study_groups WHERE id = $1" ? state.group : sql.startsWith("SELECT g.id FROM bible_study_groups") && options.assigned !== false ? { id: 11 } : null) as any;
  db.all = (async () => []) as any;
  db.run = (async (sql: string) => { assert.match(sql, /INSERT INTO audit_logs/); return { changes: 1 }; }) as any;
  db.transaction = async callback => {
    transactions++;
    const before = structuredClone(state);
    try {
      const result = await callback({ query: async (sql: string, params: any[] = []) => {
        const query = sql.replace(/\s+/g, " ").trim();
        if (query.startsWith("SELECT status")) return { rows: [{ status: state.group.status, curriculum: state.group.curriculum }] };
        if (query.startsWith("SELECT topic_title FROM bible_study_sessions")) return { rows: options.recordedBook ? [{ topic_title: options.recordedBook }] : [] };
        if (query.startsWith("SELECT 1 FROM bible_study_sessions")) return { rows: options.newer ? [{}] : [] };
        if (query.startsWith("SELECT member_id")) return { rows: [{ member_id: 2 }] };
        if (query.startsWith("INSERT INTO bible_study_sessions")) {
          assert.match(query, /COALESCE\(EXCLUDED.progress_stage, bible_study_sessions.progress_stage\)/);
          state.sessions.push({ date: params[1], book: params[2], chapter: params[3], stage: params[8], notes: params[4] });
          return { rows: [] };
        }
        if (query.startsWith("UPDATE bible_study_groups")) {
          assert.match(query, /progress_stage = COALESCE\(\$3,/);
          assert.match(query, /curriculum = CASE WHEN \$5 THEN curriculum ELSE \$1 END/);
          assert.match(query, /progress_notes = COALESCE\(\$6, progress_notes\)/);
          const oldBook = state.group.curriculum;
          Object.assign(state.group, { curriculum: params[4] ? oldBook : params[0], current_chapter: params[1], progress_stage: params[2] ?? (!params[4] && oldBook !== params[0] ? "in_progress" : state.group.progress_stage) });
          if (params[5] != null) state.group.progress_notes = params[5];
          return { rows: [] };
        }
        if (query.startsWith("INSERT INTO bible_study_attendance")) {
          if (options.failAttendance) throw new Error("Attendance write failed");
          state.attendance.push(params);
          return { rows: [] };
        }
        throw new Error("Unexpected query: " + query);
      } } as any);
      committed = true;
      return result;
    } catch (error) { state = before; throw error; }
  };
  let status = 200, response: any;
  const res = { status: (code: number) => { status = code; return res; }, json: (value: any) => { response = value; return res; } };
  try {
    const layer = (router as any).stack.find((entry: any) => entry.route?.path === "/:id/attendance" && entry.route.methods.post);
    await layer.route.stack.at(-1).handle({ params: { id: "11" }, body: { session_date: "2026-09-30", topic_title: "Discipleship", chapter: "Chapter 3", present_member_ids: [2], update_group_progress: true, ...body }, user: { id: 1, role_name: options.role || "Pastor" } }, res);
    return { state, status, response, transactions, notifications };
  } finally { Object.assign(db, original); (studyNotifications as any).sendBibleStudyUpdateNotification = originalNotify; }
}

test("attendance stores exam stage and advances current lesson in one transaction", async () => {
  const result = await save({ progress_stage: "exam" });
  assert.equal(result.status, 200);
  assert.equal(result.transactions, 1);
  assert.equal(result.state.sessions[0].stage, "exam");
  assert.equal(result.state.group.progress_stage, "exam");
  assert.equal(result.state.group.current_chapter, "Chapter 3");
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].groupId, 11);
  assert.equal(result.notifications[0].committed, true);
  assert.deepEqual(result.notifications[0].options, { actorName: "Group facilitator", sessionDate: "2026-09-30" });
});

test("chapter finished leaves the whole study active", async () => {
  const result = await save({ progress_stage: "chapter_completed" });
  assert.equal(result.status, 200);
  assert.equal(result.state.group.progress_stage, "chapter_completed");
  assert.equal(result.state.group.status, "active");
});

test("historical attendance can save its stage without changing current progress", async () => {
  const result = await save({ progress_stage: "review", update_group_progress: false }, { newer: true });
  assert.equal(result.status, 200);
  assert.equal(result.state.sessions[0].stage, "review");
  assert.equal(result.state.group.progress_stage, "midway");
  assert.equal(result.state.group.curriculum, "Romans");
});

test("historical sessions cannot rewind group progress", async () => {
  const result = await save({ progress_stage: "intro" }, { newer: true });
  assert.equal(result.status, 409);
  assert.equal(result.state.sessions.length, 0);
  assert.equal(result.state.group.progress_stage, "midway");
});

test("failed attendance rolls back session, book, chapter, and stage", async () => {
  const result = await save({ progress_stage: "exam" }, { failAttendance: true });
  assert.equal(result.status, 500);
  assert.equal(result.state.sessions.length, 0);
  assert.equal(result.state.group.curriculum, "Romans");
  assert.equal(result.state.group.current_chapter, "Chapter 2");
  assert.equal(result.state.group.progress_stage, "midway");
  assert.equal(result.notifications.length, 0);
});

test("invalid stages fail before any transaction", async () => {
  for (const stage of ["unknown", 123, null]) {
    const result = await save({ progress_stage: stage });
    assert.equal(result.status, 400);
    assert.equal(result.transactions, 0);
    assert.equal(result.notifications.length, 0);
  }
});

test("older callers without a stage keep compatible progress behavior", async () => {
  const same = await save({ topic_title: "Romans" });
  assert.equal(same.state.group.progress_stage, "midway");
  assert.equal(same.state.sessions[0].stage, null);
  const changed = await save({});
  assert.equal(changed.state.group.progress_stage, "in_progress");
});

test("leaders can advance chapters and stages only in their assigned book", async () => {
  const result = await save({ topic_title: "Romans", progress_stage: "review" }, { role: "Leader" });
  assert.equal(result.status, 200);
  assert.equal(result.state.group.curriculum, "Romans");
  assert.equal(result.state.group.current_chapter, "Chapter 3");
  assert.equal(result.state.group.progress_stage, "review");
});

test("leaders cannot change the book with or without the progress checkbox", async () => {
  for (const update_group_progress of [true, false]) {
    const result = await save({ progress_stage: "exam", update_group_progress }, { role: "Leader" });
    assert.equal(result.status, 403);
    assert.equal(result.state.sessions.length, 0);
    assert.equal(result.state.group.curriculum, "Romans");
  }
});

test("leaders preserve an older session's recorded book without rewinding current book", async () => {
  const result = await save({ topic_title: "Discipleship", progress_stage: "review", update_group_progress: false }, { role: "Leader", recordedBook: "Discipleship", newer: true });
  assert.equal(result.status, 200);
  assert.equal(result.state.sessions[0].book, "Discipleship");
  assert.equal(result.state.group.curriculum, "Romans");
  const omitted = await save({ topic_title: undefined, update_group_progress: false }, { role: "Leader", recordedBook: "Discipleship" });
  assert.equal(omitted.state.sessions[0].book, "Discipleship");
});

test("leaders cannot write attendance to unassigned groups even without updating progress", async () => {
  const result = await save({ update_group_progress: false }, { role: "Leader", assigned: false });
  assert.equal(result.status, 403);
  assert.equal(result.transactions, 0);
});

test("leader attendance never assigns the fallback label as a new book", async () => {
  const result = await save({ topic_title: "Weekly Bible Study", progress_stage: "intro" }, { role: "Leader", assignedBook: null });
  assert.equal(result.status, 200);
  assert.equal(result.state.group.curriculum, null);
  assert.equal(result.state.sessions[0].book, "Weekly Bible Study");
});

test("a lesson notice is saved with attendance and optionally advances the group notice", async () => {
  const notes = "Chapter 3, verses 1–17, page 18, question #3";
  const latest = await save({ notes, progress_stage: "review", topic_title: "Romans" }, { role: "Leader" });
  assert.equal(latest.status, 200);
  assert.equal(latest.state.sessions[0].notes, notes);
  assert.equal(latest.state.group.progress_notes, notes);
  const historic = await save({ notes, update_group_progress: false });
  assert.equal(historic.state.sessions[0].notes, notes);
  assert.equal(historic.state.group.progress_notes, "Continue at page 12");
  const failed = await save({ notes }, { failAttendance: true });
  assert.equal(failed.status, 500);
  assert.equal(failed.state.group.progress_notes, "Continue at page 12");
});

test("an empty lesson notice clears the group notice while omitted notes preserve it", async () => {
  assert.equal((await save({ notes: "" })).state.group.progress_notes, "");
  assert.equal((await save({})).state.group.progress_notes, "Continue at page 12");
});

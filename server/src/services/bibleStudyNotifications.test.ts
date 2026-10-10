import assert from "node:assert/strict";
import { test, TestContext } from "node:test";
import { db } from "../db/schema";
import * as settings from "./notificationSettings";
import * as worker from "./emailOutboxWorker";
import * as socket from "../socket";
import { notify } from "./notificationService";
import { sendBibleStudyUpdateNotification } from "./bibleStudyNotifications";

function fixture(t: TestContext, options: { absent?: boolean; missing?: boolean; longName?: boolean } = {}) {
  const group = { id: 11, name: options.longName ? "G".repeat(255) : "Faith Group", curriculum: "Romans", current_chapter: "Chapter 3", progress_stage: "review", progress_notes: "Page 18, question #3 <script>", ministry_id: 2, meeting_day: "Wednesday", meeting_time: "7 PM - 8 PM", location: "Room 1" };
  const session = { id: 20, topic_title: "John", chapter: "Chapter 2", progress_stage: "exam", notes: "Verses 1–17" };
  const notifications: any[] = [], emails: any[] = [], logs: any[] = [], recipientQueries: string[] = [];
  const keys = new Set<string>();
  let id = 0;
  t.mock.method(settings, "getNotificationEmailSettings", async () => ({ pastorEmail: "pastor@example.test" } as any));
  const pump = t.mock.method(worker, "processEmailOutbox", async () => {});
  const events = t.mock.method(socket, "emitUserEvent", () => {});
  t.mock.method(db, "get", (async (sql: string) => {
    if (sql.includes("FROM bible_study_groups")) return options.missing ? null : group;
    if (sql.includes("FROM bible_study_sessions")) return session;
    if (sql.includes("SELECT threshold")) return { threshold: 3 };
    throw new Error("Unexpected read: " + sql);
  }) as any);
  t.mock.method(db, "all", (async (sql: string, params: any[]) => {
    if (sql.includes("FROM notification_rules")) {
      assert.equal(params[0], "bible_study_update");
      return [
        { id: 1, recipient_type: "role", recipient_value: "Pastor", ministry_id: null, email_enabled: true, in_app_enabled: true },
        { id: 2, recipient_type: "email", recipient_value: "pastor", ministry_id: null, email_enabled: true, in_app_enabled: false },
      ];
    }
    if (sql.includes("JOIN roles")) {
      assert.equal(params[0], "Pastor");
      recipientQueries.push(sql);
      return [{ id: 7, email: "pastor@example.test" }, { id: 8, email: null }];
    }
    if (sql.includes("FROM bible_study_attendance a")) return [{ member_id: 2, display_name: "Grace Reyes", status: options.absent ? "absent" : "present" }];
    if (sql.includes("FROM bible_study_attendance")) return ["2026-09-30", "2026-09-23", "2026-09-16"].map(date => ({ member_id: 2, session_date: date, status: "absent" }));
    throw new Error("Unexpected read: " + sql);
  }) as any);
  t.mock.method(db, "transaction", async (callback: any) => callback({ query: async (sql: string, params: any[]) => {
    if (sql.includes("INSERT INTO notification_log")) {
      const channel = sql.includes("'in_app'") ? "in_app" : "email";
      const key = JSON.stringify([params[0], params[1], channel, params[2]]);
      if (keys.has(key)) return { rows: [] };
      keys.add(key);
      const log = { id: ++id, type: params[0], key: params[1], channel, recipient: params[2] };
      logs.push(log);
      return { rows: [{ id: log.id }] };
    }
    if (sql.includes("INSERT INTO notifications")) {
      const notification = { id: ++id, user_id: params[0], type: params[1], title: params[2], message: params[3], link_tab: params[4], link_ref_id: params[5] };
      notifications.push(notification);
      return { rows: [notification] };
    }
    if (sql.includes("UPDATE notification_log")) return { rows: [] };
    if (sql.includes("INSERT INTO email_outbox")) { emails.push({ to: params[1], subject: params[2], html: params[3] }); return { rows: [] }; }
    throw new Error("Unexpected write: " + sql);
  } }));
  return { group, session, notifications, emails, logs, recipientQueries, pump, events };
}

test("all-present attendance creates Pastor notifications and one email for overlapping recipient rules", async t => {
  const store = fixture(t);
  await sendBibleStudyUpdateNotification(11, { actorName: "Assigned Leader", sessionDate: "2026-09-30" });
  assert.deepEqual(store.notifications.map(item => item.user_id), [7, 8]);
  assert.equal(store.emails.length, 1);
  assert.equal(store.emails[0].to, "pastor@example.test");
  assert.match(store.notifications[0].message, /Saved by: Assigned Leader/);
  assert.match(store.notifications[0].message, /Book: John\nChapter: Chapter 2\nStage: Exam/);
  assert.match(store.notifications[0].message, /Attendance: 1 present • 0 absent/);
  assert.match(store.notifications[0].message, /Lesson Notice & Specific Location: Verses 1–17/);
  assert.match(store.emails[0].html, /Weekly session recorded/);
  assert.match(store.emails[0].html, /LESSON COVERED/);
  assert.match(store.emails[0].html, /PRESENT/);
  assert.match(store.emails[0].html, /role="presentation"/);
  assert.equal(store.notifications[0].link_ref_id, 11);
  assert.equal(store.events.mock.callCount(), 2);
  assert.equal(store.pump.mock.callCount(), 1);
  assert.ok(store.recipientQueries.every(query => !query.includes("user_ministries"))); // Pastors receive church-wide updates.
  await notify("bible_study_update", { eventKey: store.logs[0].key, title: store.notifications[0].title, message: store.notifications[0].message });
  assert.equal(store.notifications.length, 2);
  assert.equal(store.emails.length, 1); // Retrying the same event cannot duplicate either channel.
});

test("progress saves include the exact lesson notice and schedule, with safely escaped email content", async t => {
  const store = fixture(t, { longName: true });
  await sendBibleStudyUpdateNotification(11, { actorName: "Leader" });
  assert.equal(store.notifications.length, 2);
  assert.match(store.notifications[0].message, /Book: Romans\nChapter: Chapter 3\nStage: Review/);
  assert.match(store.notifications[0].message, /Page 18, question #3/);
  assert.match(store.notifications[0].message, /Regular schedule: Wednesday • 7 PM - 8 PM/);
  assert.ok(!store.notifications[0].message.includes("Attendance:"));
  assert.match(store.emails[0].html, /&lt;script&gt;/);
  assert.ok(!store.emails[0].html.includes("<script>"));
  assert.match(store.emails[0].html, /Study progress updated/);
  assert.ok(!store.emails[0].html.includes(">PRESENT<"));
  assert.equal(store.notifications[0].title.length, 255);
  await sendBibleStudyUpdateNotification(11, { actorName: "Leader" });
  assert.equal(store.emails.length, 2); // A later successful save gets its own event.
  assert.notEqual(store.logs[0].key, store.logs.at(-1).key);
});

test("absences and attention flags stay in the single attendance notification", async t => {
  const store = fixture(t, { absent: true });
  await sendBibleStudyUpdateNotification(11, { actorName: "Leader", sessionDate: "2026-09-30" });
  assert.equal(store.emails.length, 1);
  assert.match(store.notifications[0].message, /0 present • 1 absent/);
  assert.match(store.notifications[0].message, /Grace Reyes \(3 consecutive absences/);
  assert.match(store.emails[0].html, /Absent members &amp; follow-up/);
  assert.match(store.emails[0].html, /Grace Reyes \(3 consecutive absences/);
});

test("a missing group does not queue an alert", async t => {
  const store = fixture(t, { missing: true });
  await sendBibleStudyUpdateNotification(11, { actorName: "Leader" });
  assert.equal(store.notifications.length, 0);
  assert.equal(store.emails.length, 0);
});

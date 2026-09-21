import assert from "node:assert/strict";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import { db, initSchema, sql } from "./db/schema";
import { JWT_SECRET } from "./middleware/auth";
import membersRouter from "./routes/members";
import eventsRouter from "./routes/events";
import servicesRouter from "./routes/services";
import attendanceLogRouter from "./routes/attendanceLog";
import { computeMemberAttendanceSummary, autoGenerateSundayServices } from "./utils/attendanceRules";

async function runPhase2Tests() {
  console.log("🧪 Running Phase 2: Per-Member Attendance Intelligence & Event Attendance Tests...");

  await initSchema();

  const app = express();
  app.use(express.json());
  app.use("/api/members", membersRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/services", servicesRouter);
  app.use("/api/attendance-log", attendanceLogRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://localhost:${port}/api`;

  // 1. Get an Admin user for authenticated requests
  const adminUser = await db.get("SELECT u.id, u.name, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Admin' LIMIT 1");
  const adminToken = adminUser ? jwt.sign({ id: adminUser.id }, JWT_SECRET) : null;
  assert.ok(adminToken, "Admin user and token must exist");

  // 2. Ensure test member exists
  let testMember = await db.get("SELECT id, first_name, last_name, ministry_id FROM members LIMIT 1");
  if (!testMember) {
    const min = await db.get("SELECT id FROM ministries LIMIT 1");
    const mRes = await db.run(`
      INSERT INTO members (first_name, last_name, birthdate, gender, ministry_id, status)
      VALUES ('Joshua', 'Reyes', '2000-05-15', 'Male', $1, 'active')
      RETURNING id
    `, [min?.id || 1]);
    testMember = { id: mRes.lastInsertRowid, first_name: "Joshua", last_name: "Reyes", ministry_id: min?.id || 1 };
  }

  // 3. Test Phase 1 Services auto-generation
  const genRes = await fetch(`${baseUrl}/services/generate-sundays`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(genRes.status, 200, "Generate sundays should return 200");
  console.log("  ✓ Service calendar auto-generation verified");

  // 4. Test Member Attendance Summary Calculation
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const [y, m, d] = todayStr.split("-").map(Number);
  const fromDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(y, m - 1, d - 12 * 7)
  );

  const summary = await computeMemberAttendanceSummary(testMember.id, fromDate, todayStr);
  assert.ok(summary, "computeMemberAttendanceSummary should return summary object");
  assert.equal(summary.member_id, testMember.id);
  assert.equal(typeof summary.sunday_service.attendance_rate_percentage, "number");
  assert.equal(typeof summary.bible_study.attendance_rate_percentage, "number");
  assert.ok(summary.events, "Summary should include events metrics");
  assert.equal(typeof summary.events.attended, "number");
  console.log(`  ✓ computeMemberAttendanceSummary verified (Sunday Rate: ${summary.sunday_service.attendance_rate_percentage}%, Streaks: ${summary.sunday_service.current_streak}, Events Attended: ${summary.events.attended})`);

  // 5. Test GET /api/members/:id/attendance-summary HTTP endpoint
  const memberSummaryHttpRes = await fetch(`${baseUrl}/members/${testMember.id}/attendance-summary?from=${fromDate}&to=${todayStr}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(memberSummaryHttpRes.status, 200, "GET /api/members/:id/attendance-summary should return 200");
  const memberSummaryHttpData = await memberSummaryHttpRes.json() as any;
  assert.equal(memberSummaryHttpData.member.id, testMember.id);
  assert.ok(memberSummaryHttpData.sunday_service);
  assert.ok(memberSummaryHttpData.events);
  console.log("  ✓ GET /api/members/:id/attendance-summary HTTP endpoint verified");

  // 6. Test Event Attendance Roster & Marking
  let testEvent = await db.get("SELECT id, title FROM events LIMIT 1");
  if (!testEvent) {
    const eRes = await db.run(`
      INSERT INTO events (title, description, start_time, end_time, location)
      VALUES ('Youth Camp 2026', 'Annual Church Youth Fellowship', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '4 hours', 'Main Sanctuary')
      RETURNING id
    `);
    testEvent = { id: eRes.lastInsertRowid, title: "Youth Camp 2026" };
  }

  // Get Roster
  const rosterRes = await fetch(`${baseUrl}/events/${testEvent.id}/attendance-roster`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(rosterRes.status, 200, "GET /api/events/:id/attendance-roster should return 200");
  const rosterData = await rosterRes.json() as any;
  assert.ok(Array.isArray(rosterData.attendees), "Roster should contain attendees array");
  console.log(`  ✓ Event attendance roster verified (Found ${rosterData.attendees.length} members)`);

  // Mark Member as Attended for the Event
  const markRes = await fetch(`${baseUrl}/events/${testEvent.id}/attendance/mark`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      member_ids: [testMember.id],
      status: "attended",
      notes: "Attended event test"
    })
  });
  assert.equal(markRes.status, 200, "POST /api/events/:id/attendance/mark should return 200");
  const markData = await markRes.json() as any;
  assert.equal(markData.success, true);
  console.log("  ✓ Event attendance mark endpoint verified");

  // 7. Verify that Event Attendance appears in the Unified Attendance Log
  const attLogRes = await fetch(`${baseUrl}/attendance-log?type=event&memberId=${testMember.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(attLogRes.status, 200, "GET /api/attendance-log with type=event should return 200");
  const attLogData = await attLogRes.json() as any;
  assert.ok(Array.isArray(attLogData.rows));
  const foundEventLog = attLogData.rows.find((r: any) => r.memberId === testMember.id && r.logType === "event");
  assert.ok(foundEventLog, "Event attendance must appear in attendance_log view with logType='event'");
  console.log(`  ✓ Unified Attendance Log verified with log_type='event' (Event Name: '${foundEventLog.eventName}')`);

  server.close();
  console.log("\n🎉 ALL PHASE 2 & EVENT ATTENDANCE INTEGRATION TESTS PASSED SUCCESSFULLY!\n");
}

runPhase2Tests().catch((err) => {
  console.error("❌ Phase 2 test failure:", err);
  process.exit(1);
});

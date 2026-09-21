import assert from "node:assert/strict";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import { db, initSchema } from "./db/schema";
import { JWT_SECRET } from "./middleware/auth";
import membersRouter from "./routes/members";
import {
  computeMemberAttendanceSummary,
  getElapsedCalendarSundays,
  getConsistencyTier
} from "./utils/attendanceRules";

async function runUnifiedAttendanceTests() {
  console.log("🧪 Running Unified Attendance & Spiritual Milestones Tests...");

  await initSchema();

  const app = express();
  app.use(express.json());
  app.use("/api/members", membersRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // 1. Test getElapsedCalendarSundays
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    
    // Future range test: from today to 1 year ahead -> should only return at most 1 Sunday if today is Sunday, 0 if weekday
    const futureFrom = "2030-01-01";
    const futureTo = "2030-12-31";
    const futureSundays = getElapsedCalendarSundays(futureFrom, futureTo, todayStr);
    assert.equal(futureSundays.length, 0, "Future date ranges after today must return 0 elapsed Sundays");

    // Range ending in future: from 4 weeks back to 4 weeks ahead -> must cap at todayStr
    const [y, m, d] = todayStr.split("-").map(Number);
    const fourWeeksBack = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
      new Date(y, m - 1, d - 28)
    );
    const fourWeeksAhead = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
      new Date(y, m - 1, d + 28)
    );
    const cappedSundays = getElapsedCalendarSundays(fourWeeksBack, fourWeeksAhead, todayStr);
    for (const s of cappedSundays) {
      assert.ok(s <= todayStr, `Elapsed Sunday ${s} must be <= today ${todayStr}`);
    }
    console.log("  ✓ Future Sundays strictly excluded from calendar calculations");

    // 2. Consistency Tier tests
    assert.equal(getConsistencyTier(null), "No Data");
    assert.equal(getConsistencyTier(90, 4), "Consistent Regular");
    assert.equal(getConsistencyTier(90, 1), "Regular Attendee", "High score without streak >= 3 is Regular Attendee");
    assert.equal(getConsistencyTier(75, 2), "Regular Attendee");
    assert.equal(getConsistencyTier(55, 1), "Developing Habit");
    assert.equal(getConsistencyTier(30, 0), "Needs Encouragement");
    assert.equal(getConsistencyTier(10, 0), "Inactive / Disengaged");
    console.log("  ✓ Consistency tiers & formula rules verified");

    // 3. Create a clean dedicated test member
    const min = await db.get("SELECT id FROM ministries LIMIT 1");
    const testMemberRes = await db.run(`
      INSERT INTO members (first_name, last_name, birthdate, gender, ministry_id, status, is_baptized, baptism_status)
      VALUES ('TestUnit', 'UnifiedMember', '2002-03-10', 'Female', $1, 'active', FALSE, 'not_baptized')
      RETURNING id
    `, [min?.id || 1]);
    const memberId = testMemberRes.lastInsertRowid;

    // 4. Test calculation with NO attendance records in a 12-week window
    const twelveWeeksBack = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
      new Date(y, m - 1, d - 12 * 7)
    );
    const summaryNoRecords = await computeMemberAttendanceSummary(memberId, twelveWeeksBack, todayStr);
    assert.equal(summaryNoRecords.sunday_service.attended, 0);
    assert.equal(summaryNoRecords.sunday_service.absent, 0);
    assert.equal(summaryNoRecords.sunday_service.excused, 0);
    assert.equal(summaryNoRecords.sunday_service.missed, summaryNoRecords.sunday_service.total_held_services);
    assert.equal(summaryNoRecords.sunday_service.current_streak, 0);
    console.log("  ✓ Empty window computation verified (missed matches total elapsed Sundays)");

    // 5. Insert 1 Present check-in on the earliest elapsed Sunday
    const elapsedSundays12w = getElapsedCalendarSundays(twelveWeeksBack, todayStr, todayStr);
    if (elapsedSundays12w.length >= 2) {
      const firstSunday = elapsedSundays12w[0];
      await db.run(`
        INSERT INTO attendance (member_id, ministry_id, checked_in_at, notes)
        VALUES ($1, $2, $3::TIMESTAMP, 'Sunday Service check-in')
      `, [memberId, min?.id || 1, `${firstSunday} 09:30:00`]);

      const summary1Present = await computeMemberAttendanceSummary(memberId, twelveWeeksBack, todayStr);
      assert.equal(summary1Present.sunday_service.attended, 1);
      const expectedRate = Math.round((1 / elapsedSundays12w.length) * 100);
      assert.equal(summary1Present.sunday_service.attendance_rate_percentage, expectedRate);
      assert.ok(summary1Present.sunday_service.attendance_rate_percentage <= 50, "1 attended out of 12 must not show 50% or 2%");

      // Insert 1 Excused on the second Sunday
      const secondSunday = elapsedSundays12w[1];
      await db.run(`
        INSERT INTO attendance (member_id, ministry_id, checked_in_at, notes)
        VALUES ($1, $2, $3::TIMESTAMP, '[EXCUSED] Sick with flu')
      `, [memberId, min?.id || 1, `${secondSunday} 09:30:00`]);

      const summaryWithExcused = await computeMemberAttendanceSummary(memberId, twelveWeeksBack, todayStr);
      assert.equal(summaryWithExcused.sunday_service.attended, 1);
      assert.equal(summaryWithExcused.sunday_service.excused, 1);
      const netExpectedRate = Math.round((1 / (elapsedSundays12w.length - 1)) * 100);
      assert.equal(summaryWithExcused.sunday_service.attendance_rate_percentage, netExpectedRate, "Excused properly subtracted from denominator");
    }
    console.log("  ✓ 1/12 accurate rate computation and excused neutrality verified");

    // 6. Test HTTP Endpoint GET /api/members/:id/attendance-summary
    const adminUser = await db.get("SELECT u.id, u.name, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Admin' LIMIT 1");
    const adminToken = adminUser ? jwt.sign({ id: adminUser.id }, JWT_SECRET) : null;

    const httpRes = await fetch(`${baseUrl}/members/${memberId}/attendance-summary?from=${twelveWeeksBack}&to=${todayStr}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const httpData: any = await httpRes.json();
    assert.ok(httpData.member, "Response must include member object");
    assert.ok(typeof httpData.member.age === "number", "Response must calculate member age");
    assert.ok(Array.isArray(httpData.monthly_breakdown), "Response must include monthly breakdown");
    assert.equal(httpData.monthly_breakdown.length, 12, "Monthly breakdown must have 12 months");
    assert.ok(httpData.baptism_tracker, "Response must include baptism tracker");
    assert.ok(Array.isArray(httpData.records), "Response must include attendance log records");
    console.log("  ✓ GET /api/members/:id/attendance-summary unified payload verified");

    // Cleanup test member
    await db.run("DELETE FROM attendance WHERE member_id = $1", [memberId]);
    await db.run("DELETE FROM members WHERE id = $1", [memberId]);

    console.log("🎉 All Unified Attendance Tests Passed Successfully!");
  } finally {
    server.close();
  }
}

runUnifiedAttendanceTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

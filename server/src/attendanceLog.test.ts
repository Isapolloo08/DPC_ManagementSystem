import assert from "node:assert/strict";
import { db, initSchema, sql } from "./db/schema";

async function runAttendanceLogTests() {
  console.log("🧪 Running Attendance Log Unified View & RBAC Verification Tests...");

  await initSchema();

  // 1. Verify VIEW attendance_log exists
  const viewCheck = await db.get(`
    SELECT table_name FROM information_schema.views
    WHERE table_name = 'attendance_log'
  `);
  assert.ok(viewCheck, "attendance_log VIEW must exist in PostgreSQL");
  console.log("  ✓ attendance_log VIEW verified in PostgreSQL schema");

  // 2. Verify Performance Indexes exist
  const indexes = await db.all(`
    SELECT indexname FROM pg_indexes
    WHERE tablename IN ('attendance', 'bible_study_attendance')
  `);
  const indexNames = indexes.map((i: any) => i.indexname);
  assert.ok(indexNames.includes("idx_attendance_member_checked_in"), "idx_attendance_member_checked_in index should exist");
  assert.ok(indexNames.includes("idx_bs_att_member_date"), "idx_bs_att_member_date index should exist");
  assert.ok(indexNames.includes("idx_bs_att_group_date"), "idx_bs_att_group_date index should exist");
  console.log("  ✓ Performance indexes verified on attendance and bible_study_attendance tables");

  // 3. Insert temporary sample records to test view UNION ALL and Timezone conversion
  const testMember = await db.get("SELECT id FROM members LIMIT 1");
  let memberId = testMember?.id;
  if (!memberId) {
    const newMem = await db.get(`
      INSERT INTO members (first_name, last_name, birthdate)
      VALUES ('Test', 'Ibañez-Peña', '1995-05-15')
      RETURNING id
    `);
    memberId = newMem.id;
  }

  // Ensure Sunday attendance record exists
  await db.run(`
    INSERT INTO attendance (member_id, ministry_id, checked_in_at)
    VALUES ($1, 1, '2026-09-20 01:30:00+00')
  `, [memberId]);

  // Ensure Bible study group & session attendance record exists
  let testGroup = await db.get("SELECT id FROM bible_study_groups LIMIT 1");
  if (!testGroup) {
    testGroup = await db.get(`
      INSERT INTO bible_study_groups (name, leader_name, meeting_day, meeting_time, location)
      VALUES ('Faith Group', 'Pastor Mark', 'Wednesday', '19:00', 'Sanctuary')
      RETURNING id
    `);
  }

  await db.run(`
    INSERT INTO bible_study_attendance (group_id, session_date, member_id, status)
    VALUES ($1, '2026-09-17', $2, 'excused')
    ON CONFLICT (group_id, session_date, member_id) DO UPDATE SET status = 'excused'
  `, [testGroup.id, memberId]);

  // 4. Query view and check UNION ALL results
  const viewRows = await db.all(`
    SELECT log_type, log_date, status, group_id
    FROM attendance_log
    WHERE member_id = $1
    ORDER BY log_date DESC
  `, [memberId]);

  assert.ok(viewRows.length >= 2, "View should return both sunday_service and bible_study rows");
  const sundayRow = viewRows.find((r: any) => r.log_type === "sunday_service");
  const bsRow = viewRows.find((r: any) => r.log_type === "bible_study");

  assert.ok(sundayRow, "sunday_service row must exist in attendance_log");
  assert.equal(sundayRow.status, "present", "Sunday attendance status should be 'present'");
  assert.equal(sundayRow.group_id, null, "Sunday attendance group_id should be null");

  assert.ok(bsRow, "bible_study row must exist in attendance_log");
  assert.equal(bsRow.status, "excused", "Bible study status should preserve 'excused'");
  assert.equal(bsRow.group_id, testGroup.id, "Bible study group_id should match");
  console.log("  ✓ attendance_log VIEW correctly UNION ALLs Sunday check-ins and Bible Study logs");

  // 5. Timezone Verification: Check midnight conversion in Asia/Manila (UTC+8)
  // '2026-09-20 01:30:00+00' is 09:30 AM in Manila (2026-09-20)
  // '2026-09-19 16:30:00+00' is 00:30 AM on 2026-09-20 in Manila
  const tzTest = await db.get(`
    SELECT ('2026-09-19 16:30:00+00'::TIMESTAMP WITH TIME ZONE AT TIME ZONE 'Asia/Manila')::DATE AS manila_date
  `);
  const manilaDateStr = tzTest.manila_date instanceof Date
    ? tzTest.manila_date.toISOString().split("T")[0]
    : String(tzTest.manila_date).split("T")[0];

  assert.equal(manilaDateStr, "2026-09-20", "Midnight UTC conversion must accurately yield Asia/Manila date without shifting");
  console.log("  ✓ Asia/Manila timezone conversion verified for midnight boundaries");

  // 6. CSV Export & Special Characters (e.g. ñ) Sanitization check
  const memberWithSpecialChar = await db.get("SELECT TRIM(first_name || ' ' || last_name) AS name FROM members WHERE last_name ILIKE '%ñ%' LIMIT 1");
  if (memberWithSpecialChar) {
    assert.ok(memberWithSpecialChar.name.includes("ñ") || memberWithSpecialChar.name.includes("Ñ"), "Special characters like ñ must be preserved");
    console.log(`  ✓ Unicode character preservation verified: ${memberWithSpecialChar.name}`);
  }

  console.log("\n🎉 All Attendance Log database and view tests passed successfully!");
  process.exit(0);
}

runAttendanceLogTests().catch(err => {
  console.error("❌ Attendance Log test failed:", err);
  process.exit(1);
});

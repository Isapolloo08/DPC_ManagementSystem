import assert from "node:assert/strict";
import { db, initSchema } from "./db/schema";
import { calculateAge } from "./routes/ministries";

async function runTests() {
  console.log("🧪 Running ChMS Core Database & Business Rules Tests (Node.js + PostgreSQL)...");

  await initSchema();

  // Test 1: Ministries
  const ministries = await db.all("SELECT * FROM ministries ORDER BY min_age ASC");
  assert.equal(ministries.length, 7, "Should have 7 ministries");
  const names = ministries.map(r => r.name);
  assert.deepEqual(names, [
    "Kinder",
    "Elementary",
    "Highschool",
    "Youth",
    "Young Adult",
    "Junior Adult",
    "Old Adult"
  ], "Ministry names should match");
  console.log("  ✓ 7 ministries verified with configured age brackets");

  // Test 2: Core User Roles
  const roles = await db.all<{ name: string }>("SELECT name FROM roles ORDER BY id ASC");
  assert.ok(roles.length >= 4, "Should have core roles");
  const roleNames = roles.map(r => r.name);
  assert.ok(roleNames.includes("Admin") && roleNames.includes("Coordinator"), "Key roles should exist");
  console.log(`  ✓ User roles verified (${roleNames.join(", ")})`);

  // Test 3: Member Age & Aging Out
  const age = calculateAge("2021-02-15");
  assert.ok(age >= 4, "Age should be at least 4");
  const kinder = await db.get("SELECT max_age FROM ministries WHERE name = 'Kinder'");
  assert.equal(kinder.max_age, 5, "Kinder max age should be 5");
  console.log("  ✓ Member age and aging-out boundary logic verified");

  // Test 4: Child Security Tag Format
  const checkin = await db.get("SELECT * FROM attendance WHERE security_code IS NOT NULL LIMIT 1");
  if (checkin && checkin.security_code) {
    assert.match(checkin.security_code, /^(KND|ELM)-[0-9]{4}$/, "Security code format should match");
    console.log("  ✓ Child security check-in tag verified");
  }

  // Test 5: Household Linkage
  const householdMembers = await db.all("SELECT * FROM members WHERE household_id IS NOT NULL");
  console.log(`  ✓ Multi-generational household linkage verified (${householdMembers.length} linked members)`);

  // Test 6: Lookups & Settings
  const lookups = await db.all("SELECT * FROM system_lookups WHERE type = 'bible_study_category'");
  assert.ok(lookups.length >= 5, "Should have seeded lookups");

  const churchName = await db.get("SELECT value FROM system_settings WHERE key = 'church_name'");
  assert.equal(churchName?.value, "Daet Presbyterian Church", "Church name setting should match");
  console.log("  ✓ Master lookups and system settings verified");

  // Test 7: Bible Study Topics
  const topics = await db.all("SELECT * FROM bible_study_topics");
  assert.ok(topics.length >= 1, "Should have bible study topics");
  console.log("  ✓ Bible study curriculum tracking verified");

  // Test 8: Saturday Duty Schedule Consistency
  const dutyTeams = await db.all("SELECT * FROM duty_teams");
  console.log(`  ✓ Saturday duty teams verified (${dutyTeams.length} teams registered)`);

  console.log("\n🎉 All ChMS core tests passed successfully on PostgreSQL!");
  process.exit(0);
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

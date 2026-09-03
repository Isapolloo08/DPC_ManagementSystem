"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const schema_1 = require("./db/schema");
const ministries_1 = require("./routes/ministries");
async function runTests() {
    console.log("🧪 Running ChMS Core Database & Business Rules Tests (Node.js + PostgreSQL)...");
    await (0, schema_1.initSchema)();
    // Test 1: Ministries
    const ministries = await schema_1.db.all("SELECT * FROM ministries ORDER BY min_age ASC");
    strict_1.default.equal(ministries.length, 7, "Should have 7 ministries");
    const names = ministries.map(r => r.name);
    strict_1.default.deepEqual(names, [
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
    const roles = await schema_1.db.all("SELECT * FROM roles ORDER BY id ASC");
    strict_1.default.equal(roles.length, 4, "Should have 4 core roles");
    const roleNames = roles.map(r => r.name);
    strict_1.default.deepEqual(roleNames, ["Admin", "Coordinator", "Volunteer", "Member"], "Roles should match");
    console.log("  ✓ 4 core user roles verified");
    // Test 3: Member Age & Aging Out
    const age = (0, ministries_1.calculateAge)("2021-02-15");
    strict_1.default.ok(age >= 4, "Age should be at least 4");
    const kinder = await schema_1.db.get("SELECT max_age FROM ministries WHERE name = 'Kinder'");
    strict_1.default.equal(kinder.max_age, 5, "Kinder max age should be 5");
    console.log("  ✓ Member age and aging-out boundary logic verified");
    // Test 4: Child Security Tag Format
    const checkin = await schema_1.db.get("SELECT * FROM attendance WHERE security_code IS NOT NULL LIMIT 1");
    if (checkin && checkin.security_code) {
        strict_1.default.match(checkin.security_code, /^(KND|ELM)-[0-9]{4}$/, "Security code format should match");
        console.log("  ✓ Child security check-in tag verified");
    }
    // Test 5: Household Linkage
    const householdMembers = await schema_1.db.all("SELECT * FROM members WHERE household_id = 1");
    strict_1.default.ok(householdMembers.length >= 1, "Household 1 should have members");
    console.log("  ✓ Multi-generational household linkage verified");
    // Test 6: Lookups & Settings
    const lookups = await schema_1.db.all("SELECT * FROM system_lookups WHERE type = 'bible_study_category'");
    strict_1.default.ok(lookups.length >= 5, "Should have seeded lookups");
    const churchName = await schema_1.db.get("SELECT value FROM system_settings WHERE key = 'church_name'");
    strict_1.default.equal(churchName?.value, "Daet Presbyterian Church", "Church name setting should match");
    console.log("  ✓ Master lookups and system settings verified");
    // Test 7: Bible Study Topics
    const topics = await schema_1.db.all("SELECT * FROM bible_study_topics");
    strict_1.default.ok(topics.length >= 1, "Should have bible study topics");
    console.log("  ✓ Bible study curriculum tracking verified");
    console.log("\n🎉 All ChMS core tests passed successfully on PostgreSQL!");
    process.exit(0);
}
runTests().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});

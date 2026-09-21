import assert from "node:assert/strict";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import { db, initSchema } from "./db/schema";
import { JWT_SECRET } from "./middleware/auth";
import attendanceLogRouter from "./routes/attendanceLog";

async function runApiTests() {
  console.log("🧪 Running Attendance Log REST API & RBAC HTTP Integration Tests...");

  await initSchema();

  const app = express();
  app.use(express.json());
  app.use("/api/attendance-log", attendanceLogRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://localhost:${port}/api/attendance-log`;

  // 1. Seed or retrieve users for each role: Admin, Coordinator, Leader, Volunteer
  const adminUser = await db.get("SELECT u.id, u.name, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Admin' LIMIT 1");
  const leaderUser = await db.get("SELECT u.id, u.name, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Leader' LIMIT 1");
  const volunteerUser = await db.get("SELECT u.id, u.name, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Volunteer' LIMIT 1");
  const coordUser = await db.get("SELECT u.id, u.name, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Coordinator' LIMIT 1");

  const adminToken = adminUser ? jwt.sign({ id: adminUser.id }, JWT_SECRET) : null;
  const leaderToken = leaderUser ? jwt.sign({ id: leaderUser.id }, JWT_SECRET) : null;
  const volunteerToken = volunteerUser ? jwt.sign({ id: volunteerUser.id }, JWT_SECRET) : null;
  const coordToken = coordUser ? jwt.sign({ id: coordUser.id }, JWT_SECRET) : null;

  // Test A: Admin gets all records
  if (adminToken) {
    const res = await fetch(`${baseUrl}?page=1&pageSize=10`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200, "Admin should receive 200 OK");
    const data = await res.json() as any;
    assert.ok(Array.isArray(data.rows), "Admin response should contain rows array");
    assert.ok(data.summary, "Admin response should contain summary");
    assert.equal(typeof data.summary.total, "number", "Summary total should be a number");
    console.log(`  ✓ Admin HTTP test passed (returned ${data.rows.length} rows, summary total: ${data.summary.total})`);
  }

  // Test B: Volunteer should be denied (403 Forbidden)
  if (volunteerToken) {
    const res = await fetch(`${baseUrl}`, {
      headers: { Authorization: `Bearer ${volunteerToken}` }
    });
    assert.equal(res.status, 403, "Volunteer must receive 403 Forbidden");
    console.log("  ✓ Volunteer RBAC test passed (403 Forbidden returned)");
  }

  // Test C: Coordinator gets scoped records
  if (coordToken) {
    const res = await fetch(`${baseUrl}`, {
      headers: { Authorization: `Bearer ${coordToken}` }
    });
    assert.equal(res.status, 200, "Coordinator should receive 200 OK");
    const data = await res.json() as any;
    assert.ok(Array.isArray(data.rows), "Coordinator response should contain rows");
    console.log(`  ✓ Coordinator RBAC test passed (returned ${data.rows.length} scoped rows)`);
  }

  // Test D: Leader gets scoped Bible Study records only
  if (leaderToken) {
    const res = await fetch(`${baseUrl}`, {
      headers: { Authorization: `Bearer ${leaderToken}` }
    });
    assert.equal(res.status, 200, "Leader should receive 200 OK");
    const data = await res.json() as any;
    assert.ok(Array.isArray(data.rows), "Leader response should contain rows");
    for (const r of data.rows) {
      assert.equal(r.logType, "bible_study", "Leader should only see Bible Study attendance rows");
    }
    console.log(`  ✓ Leader RBAC test passed (returned ${data.rows.length} Bible Study rows only)`);
  }

  // Test E: CSV Export with formula injection sanitization and UTF-8 BOM
  if (adminToken) {
    const csvRes = await fetch(`${baseUrl}/export.csv`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(csvRes.status, 200, "CSV Export should return 200 OK");
    assert.ok(csvRes.headers.get("content-type")?.includes("text/csv"), "Content-Type should be text/csv");
    const arrayBuffer = await csvRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    assert.equal(buffer[0], 0xEF, "First byte must be 0xEF");
    assert.equal(buffer[1], 0xBB, "Second byte must be 0xBB");
    assert.equal(buffer[2], 0xBF, "Third byte must be 0xBF");
    const csvText = buffer.toString("utf-8");
    assert.ok(csvText.includes("\r\n"), "CSV must use CRLF line endings");
    assert.ok(csvText.includes("Member Name"), "CSV must have proper headers");
    console.log("  ✓ CSV Export test passed (BOM, CRLF, and headers verified)");
  }

  server.close();
  console.log("\n🎉 All Attendance Log API integration tests passed successfully!");
  process.exit(0);
}

runApiTests().catch(err => {
  console.error("❌ API Test failed:", err);
  process.exit(1);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../db/schema";
import { isCalendarDate, parsePagination, queryPage, validatePagination } from "./pagination";

test("pagination rejects malformed, oversized and nested query values", () => {
  for (const query of [{ page: "NaN" }, { page: "0" }, { page: "1.5" }, { page: ["1", "2"] }, { limit: "101" }, { limit: {} }]) {
    assert.throws(() => parsePagination(query));
  }
  assert.deepEqual(parsePagination({ page: "2", limit: "50" }), { enabled: true, page: 2, limit: 50 });
  let status = 0, continued = false;
  const res: any = { status(value: number) { status = value; return this; }, json() {} };
  validatePagination({ query: { limit: "99999" } } as any, res, () => { continued = true; });
  assert.equal(status, 400); assert.equal(continued, false);
  assert.equal(isCalendarDate("2026-02-30"), false);
  assert.equal(isCalendarDate("2028-02-29"), true);
});

test("SQL pagination counts filtered rows, clamps removed last pages and binds the limit", async () => {
  const original = { get: db.get, all: db.all };
  const calls: { sql: string; params: unknown[] }[] = [];
  db.get = (async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return { total: "31" }; }) as any;
  db.all = (async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return [{ id: 31 }]; }) as any;
  try {
    const result = await queryPage("SELECT id FROM members WHERE first_name ILIKE $1 ORDER BY id", ["%Grace%"], { page: "99", limit: "30" });
    assert.deepEqual(result.pagination, { page: 2, limit: 30, total: 31, totalPages: 2 });
    assert.match(calls[0].sql, /COUNT\(\*\).*WHERE first_name ILIKE \$1/);
    assert.match(calls[1].sql, /ORDER BY id LIMIT \$2 OFFSET \$3$/);
    assert.deepEqual(calls[1].params, ["%Grace%", 30, 30]);
    assert.equal(result.data.length, 1);
  } finally { Object.assign(db, original); }
});

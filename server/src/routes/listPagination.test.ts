import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../db/schema";
import groups from "./groups";
import audit from "./audit";
import users from "./users";
import communications from "./communications";
import events from "./events";
import members from "./members";

const handler = (router: any, path: string) => router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods.get).route.stack.at(-1).handle;
const response = () => {
  const res: any = { code: 200, body: null, status(code: number) { this.code = code; return this; }, json(body: unknown) { this.body = body; return this; } };
  return res;
};

for (const [name, router, path, query] of [
  ["groups", groups, "/", { search: "Romans", id: "11", status: "active" }],
  ["users", users, "/users", { search: "Pastor", role_name: "Pastor", eligible_leaders: "true" }],
  ["announcements", communications, "/announcements", { search: "Welcome" }],
  ["events", events, "/", { search: "Christmas", from: "2026-09-01", to: "2026-10-07" }],
  ["member references", members, "/", { ids: "7,18", search: "Grace" }],
] as const) {
  test(`${name} binds every search/filter and bounds the returned SQL page`, async () => {
    const original = { get: db.get, all: db.all };
    const pageCalls: { sql: string; params: unknown[] }[] = [];
    const inspect = (sql: string, params: unknown[] = []) => {
      assert.doesNotMatch(sql, /ILIKE \d+|= \d+::date|\(\d+::date/);
      const indexes = [...sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1]));
      assert.deepEqual([...new Set(indexes)].sort((a, b) => a - b), params.map((_, i) => i + 1), sql);
      if (sql.includes("LIMIT $")) pageCalls.push({ sql, params });
    };
    db.get = (async (sql: string, params: unknown[]) => { inspect(sql, params); return { total: "25", active: "25", all: "25" }; }) as any;
    db.all = (async (sql: string, params: unknown[]) => { inspect(sql, params); return []; }) as any;
    try {
      const res = response();
      await handler(router, path)({ route: { path }, query: { ...query, page: "2", limit: "10" }, user: { id: 1, role_name: "Admin" } }, res);
      assert.equal(res.code, 200, JSON.stringify(res.body));
      assert.equal(res.body.pagination.total, 25);
      assert.equal(res.body.pagination.page, 2);
      assert.equal(pageCalls.length, 1);
      assert.deepEqual(pageCalls[0].params.slice(-2), [10, 10]);
      if (name === "member references") assert.deepEqual(pageCalls[0].params[0], [7, 18]);
    } finally { Object.assign(db, original); }
  });
}

test("paged session history filters in SQL and loads attendance only for visible session dates", async () => {
  const original = { get: db.get, all: db.all };
  const calls: { sql: string; params: unknown[] }[] = [];
  db.get = (async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes("page_source")) return { total: "21" };
    if (sql.includes("MAX(s.session_date)")) return { total: "120", latest: "2026-10-07", books: ["Romans"], stages: ["review"] };
    return { id: 11, name: "Romans group", curriculum: "Romans" };
  }) as any;
  db.all = (async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes("FROM bible_study_sessions s")) return [{ id: 7, session_date: "2026-09-30", topic_title: "Romans", chapter: "Chapter 3", progress_stage: "review", present_count: 1 }];
    if (sql.includes("FROM bible_study_attendance a")) return [{ member_id: 2, session_date: "2026-09-30", status: "present", name: "Grace Reyes" }];
    throw new Error("Unexpected full-directory query: " + sql);
  }) as any;
  try {
    const res = response();
    await handler(groups, "/:id/attendance")({ params: { id: "11" }, query: { history: "true", page: "2", limit: "10", book: "Romans", stage: "review", search: "Grace", from: "2026-09-01", to: "2026-10-07" } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.pagination, { page: 2, limit: 10, total: 21, totalPages: 3 });
    assert.equal(res.body.history_summary.total, 120);
    assert.equal(res.body.data[0].attendees[0].name, "Grace Reyes");
    const page = calls.find(call => /LIMIT/.test(call.sql))!;
    assert.match(page.sql, /= \$2/); assert.match(page.sql, /= \$3/); assert.match(page.sql, /ILIKE \$4/);
    assert.match(page.sql, />= \$5::date/); assert.match(page.sql, /<= \$6::date/);
    assert.match(page.sql, /ORDER BY s.session_date DESC, s.id DESC.*LIMIT \$7 OFFSET \$8/s);
    assert.deepEqual(page.params, [11, "Romans", "review", "%Grace%", "2026-09-01", "2026-10-07", 10, 10]);
    const attendees = calls.find(call => /ANY\(\$2::date\[\]\)/.test(call.sql))!;
    assert.deepEqual(attendees.params, [11, ["2026-09-30"]]);
  } finally { Object.assign(db, original); }
});

test("audit combines bound filters before pagination and retains global summary/facets", async () => {
  const original = { get: db.get, all: db.all };
  let pageQuery = "", pageParams: unknown[] = [];
  db.get = (async (sql: string) => sql.includes("page_source") ? { total: "41" } : { total: "200", creates: "100", updates: "90", deletes: "10", uniqueOperators: "8", operators: ["Test Pastor", "Other Leader"] }) as any;
  db.all = (async (sql: string, params: unknown[]) => { pageQuery = sql; pageParams = params; return [{ id: 42 }]; }) as any;
  try {
    const res = response();
    await handler(audit, "/")({ query: { page: "2", limit: "20", action: "CREATE", operator: "Test Pastor", search: "Romans", from: "2026-09-01", to: "2026-10-07", sort: "asc" } }, res);
    assert.equal(res.code, 200); assert.equal(res.body.pagination.total, 41);
    assert.equal(res.body.summary.total, 200); assert.equal(res.body.options.operators.length, 2);
    assert.match(pageQuery, /UPPER\(a.action\) = \$1/); assert.match(pageQuery, /ILIKE \$3/);
    assert.match(pageQuery, />= \(\$4::date/); assert.match(pageQuery, /< \(\(\$5::date/);
    assert.match(pageQuery, /ORDER BY a.created_at ASC, a.id ASC.*LIMIT \$6 OFFSET \$7/s);
    assert.deepEqual(pageParams, ["CREATE", "Test Pastor", "%Romans%", "2026-09-01", "2026-10-07", 20, 20]);
  } finally { Object.assign(db, original); }
});

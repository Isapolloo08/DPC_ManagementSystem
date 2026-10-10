import assert from "node:assert/strict";
import { test } from "node:test";
import duty from "./duty";
import dishwashing from "./dishwashing";

for (const [name, router] of [["Saturday duty", duty], ["Kitchen", dishwashing]] as const) {
  test(`${name} mutations allow only Pastor, Admin and IT Admin`, () => {
    const routes = (router as any).stack.filter((entry: any) => entry.route && Object.keys(entry.route.methods).some(method => ["post", "put", "patch", "delete"].includes(method)));
    assert.ok(routes.length >= 9);
    for (const entry of routes) {
      assert.ok(entry.route.stack.length >= 3, `${entry.route.path} needs an authorization gate before its handler`);
      for (const role of [undefined, "Leader", "Coordinator", "Member", "Volunteer", "Pastor", "Admin", "IT Admin"]) {
        let status = 200, allowed = false;
        const res = { status: (value: number) => { status = value; return res; }, json: () => res };
        entry.route.stack[1].handle({ user: role ? { id: 1, role_name: role } : undefined }, res, () => { allowed = true; });
        const expected = role !== undefined && ["Pastor", "Admin", "IT Admin"].includes(role);
        assert.equal(allowed, expected, `${entry.route.path}: ${role}`);
        assert.equal(status, expected ? 200 : role ? 403 : 401);
      }
    }
  });
}

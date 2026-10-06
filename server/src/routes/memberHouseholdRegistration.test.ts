import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../db/schema";
import router from "./members";

// Invoke the application handlers against a transaction-scoped store; never access live data.
async function application(options: { existing?: boolean; otherHousehold?: boolean; failMember?: boolean; conflictingParent?: boolean; edit?: boolean; partner?: boolean; role?: string; noFamily?: boolean; relativeName?: string; rawRelative?: boolean; linkedRelative?: boolean; sourceId?: number; editHousehold?: number } = {}) {
  let state: any = {
    households: options.existing ? [{ id: 20, name: "Santos Household", father_name: options.conflictingParent ? "Pedro Santos" : null, mother_name: "Maria Santos", family_members: [{ name: "Lola Pilar", relationship: "Grandparent", member_id: null }] }] : [],
    members: [{ id: 10, first_name: "Ana", last_name: "Santos", household_id: options.otherHousehold ? 99 : options.existing ? 20 : null, attendance: ["2026-10-04"], ministry_id: 2, family_details: "Ate: Liza, Kuya: Marco, Mama: Maria, Papa: Juan" }],
    nextId: 30
  };
  if (options.edit) state.members.push({ id: 12, first_name: "Juan", last_name: "Santos", household_id: options.editHousehold || null, ministry_id: 1, address: "Own address", attendance: ["2026-10-01"] });
  if (options.relativeName && options.existing) {
    if (options.rawRelative) state.members[0].family_details = "Brother: Andrie, Lola: Pilar";
    else state.households[0].family_members.push({ name: options.relativeName, relationship: "Family Member", member_id: options.linkedRelative ? 99 : null });
  }
  const original = { get: db.get, all: db.all, run: db.run, transaction: db.transaction };
  let transactions = 0;
  let committed = false;
  const queries: string[] = [];
  db.get = (async (query: string) => query === "SELECT * FROM members WHERE id = $1" ? state.members.find((member: any) => member.id === 12) : null) as any;
  db.all = (async () => []) as any;
  db.run = (async (query: string) => {
    assert.match(query, /INSERT INTO audit_logs/); // All business writes must use the transaction client.
    return { lastInsertRowid: 1, changes: 1 };
  }) as any;
  db.transaction = async callback => {
    transactions++;
    const snapshot = structuredClone(state);
    const client = { query: async (sql: string, params: any[] = []) => {
      const query = sql.replace(/\s+/g, " ").trim();
      queries.push(query);
      if (query.startsWith("SELECT id FROM households")) return { rows: [] };
      if (query.startsWith("INSERT INTO households")) {
        const household = { id: 20, name: params[0], address: params[1], primary_contact_phone: params[2], family_members: [] };
        state.households.push(household);
        return { rows: [household], rowCount: 1 };
      }
      if (query.startsWith("SELECT * FROM households")) return { rows: state.households.filter((household: any) => household.id === params[0]) };
      if (query.startsWith("SELECT id, household_id, family_details")) return { rows: state.members.filter((member: any) => member.id === params[0]) };
      if (query.startsWith("UPDATE households SET family_members")) { state.households[0].family_members = JSON.parse(params[0]); return { rows: [], rowCount: 1 }; }
      if (/^UPDATE households SET (father|mother|guardian)_name/.test(query)) {
        state.households[0][query.match(/SET (\w+)/)![1]] = params[0];
        return { rows: [], rowCount: 1 };
      }
      if (query.startsWith("SELECT id, first_name, last_name, household_id")) return { rows: state.members.filter((member: any) => params[0].includes(member.id)) };
      if (query.startsWith("UPDATE members SET household_id")) {
        state.members.filter((member: any) => params[1].includes(member.id)).forEach((member: any) => { member.household_id = params[0]; });
        return { rows: [], rowCount: 1 };
      }
      if (query.startsWith("INSERT INTO members")) {
        if (options.failMember && params[0] === "Juan") throw new Error("Member write failed");
        const member = { id: state.nextId++, first_name: params[0], last_name: params[1], household_id: params[6], ministry_id: params[7] };
        state.members.push(member);
        return { rows: [{ id: member.id }], rowCount: 1 };
      }
      if (query.startsWith("UPDATE members SET first_name")) {
        const member = state.members.find((member: any) => member.id === Number(params.at(-1)));
        member.household_id = params[6];
        return { rows: [], rowCount: 1 };
      }
      if (query.startsWith("SELECT household_id FROM members")) return { rows: state.members.filter((member: any) => member.id === params[0]) };
      if (query.startsWith("UPDATE members SET spouse_id")) {
        const member = state.members.find((member: any) => member.id === params[2]);
        member.spouse_id = params[0];
        if (params[3]) member.household_id = params[4];
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected query: ${query}`);
    } };
    try {
      const result = await callback(client as any);
      committed = true;
      return result;
    } catch (error) {
      state = snapshot;
      throw error;
    }
  };
  const body: any = {
    first_name: "Juan", last_name: "Santos", birthdate: "1990-04-15", gender: "Male", ministry_id: 1,
    address: "Daet", contact_phone: "09111111111", civil_status: options.partner ? "Married" : "Single",
    household_registration: { mode: options.existing ? "existing" : "create", name: "Santos Household", household_id: options.existing ? 20 : null, role: options.role || "father", family_members: options.noFamily ? [] : [{ member_id: 10, name: "Old name", relationship: "Daughter" }] }
  };
  if (options.partner) body.partner_record = { first_name: "Maria", last_name: "Santos", birthdate: "1992-01-01" };
  if (options.relativeName) body.household_registration.relative = { name: options.relativeName, source_member_id: options.sourceId ?? 10 };
  let status = 200;
  let response: any;
  const res = { status: (code: number) => { status = code; return res; }, json: (value: any) => { response = value; return res; } };
  try {
    const method = options.edit ? "put" : "post";
    const path = options.edit ? "/:id" : "/";
    const layer = (router as any).stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]);
    await layer.route.stack.at(-1).handle({ body, params: { id: "12" }, user: { id: 1, role_name: "Admin" } }, res);
    return { state, status, response, transactions, committed, queries };
  } finally {
    Object.assign(db, original);
  }
}

test("parent, new spouse, household and existing child save in one transaction", async () => {
  const result = await application({ partner: true });
  assert.equal(result.status, 201);
  assert.equal(result.transactions, 1);
  assert.equal(result.committed, true);
  assert.equal(result.state.households[0].father_name, "Juan Santos");
  assert.deepEqual(result.state.households[0].family_members, [{ member_id: 10, name: "Ana Santos", relationship: "Daughter" }]);
  assert.deepEqual(result.state.members.map((member: any) => member.household_id), [20, 20, 20]);
  assert.deepEqual(result.state.members[0].attendance, ["2026-10-04"]);
  assert.equal(result.state.members[0].ministry_id, 2);
  assert.equal(result.state.members[0].family_details, "Ate: Liza, Kuya: Marco, Mama: Maria, Papa: Juan");
});

test("joining the child household retains the existing mother and custom relatives", async () => {
  const result = await application({ existing: true });
  assert.equal(result.status, 201);
  assert.equal(result.state.households.length, 1);
  assert.equal(result.state.households[0].mother_name, "Maria Santos");
  assert.equal(result.state.households[0].family_members.length, 2);
  assert.equal(result.state.households[0].family_members[0].name, "Lola Pilar");
  assert.equal(result.response.household_id, 20);
});

test("a failed parent write rolls back the new household, child link, and partner", async () => {
  const result = await application({ failMember: true, partner: true });
  assert.equal(result.status, 500);
  assert.equal(result.committed, false);
  assert.equal(result.state.households.length, 0);
  assert.equal(result.state.members.length, 1);
  assert.equal(result.state.members[0].household_id, null);
});

test("a child assigned to another household cannot be silently moved", async () => {
  const result = await application({ otherHousehold: true });
  assert.equal(result.status, 400);
  assert.equal(result.state.members[0].household_id, 99);
  assert.equal(result.state.households.length, 0);
  assert.match(result.response.error, /already belongs to another household/);
});

test("an existing father cannot be overwritten by the new application", async () => {
  const result = await application({ existing: true, conflictingParent: true });
  assert.equal(result.status, 400);
  assert.equal(result.state.households[0].father_name, "Pedro Santos");
  assert.equal(result.state.members.length, 1);
});

test("guardian registration and editing a parent support the same family links", async () => {
  const result = await application({ edit: true, role: "guardian" });
  assert.equal(result.status, 200);
  assert.equal(result.transactions, 1);
  assert.equal(result.state.households[0].guardian_name, "Juan Santos");
  assert.equal(result.state.members.find((member: any) => member.id === 12).household_id, 20);
});

test("invalid role names cannot write a household", async () => {
  const result = await application({ role: "father_name = NULL" });
  assert.equal(result.status, 400);
  assert.equal(result.state.households.length, 0);
  assert.equal(result.queries.length, 0);
});

for (const [role, relationship] of [["son", "Son"], ["daughter", "Daughter"], ["grandfather", "Grandfather"], ["grandmother", "Grandmother"], ["grandchild", "Grandchild"]]) {
  test(`${relationship} joins an existing household with their saved relationship`, async () => {
    const result = await application({ existing: true, role, noFamily: true });
    assert.equal(result.status, 201);
    assert.equal(result.transactions, 1);
    assert.equal(result.state.households[0].mother_name, "Maria Santos");
    assert.equal(result.state.households[0].father_name, null);
    assert.deepEqual(result.state.households[0].family_members, [
      { name: "Lola Pilar", relationship: "Grandparent", member_id: null },
      { member_id: 30, name: "Juan Santos", relationship }
    ]);
    assert.equal(result.state.members.find((member: any) => member.id === 30).household_id, 20);
  });
}

test("editing a relative saves the relationship against their existing member ID", async () => {
  const result = await application({ existing: true, edit: true, role: "grandmother", noFamily: true });
  assert.equal(result.status, 200);
  assert.deepEqual(result.state.households[0].family_members.at(-1), { member_id: 12, name: "Juan Santos", relationship: "Grandmother" });
});

for (const rawRelative of [false, true]) {
  test(`registering ${rawRelative ? "an application-text" : "a household"} relative binds their original name to the new member ID`, async () => {
    const result = await application({ existing: true, role: "son", noFamily: true, relativeName: "Andrie", rawRelative });
    assert.equal(result.status, 201);
    assert.equal(result.transactions, 1);
    assert.deepEqual(result.state.households[0].family_members.at(-1), { member_id: 30, name: "Juan Santos", relationship: "Son", aliases: ["Andrie"] });
    assert.equal(result.state.households[0].family_members.filter((entry: any) => entry.name === "Andrie").length, 0);
    if (rawRelative) assert.equal(result.state.members[0].family_details, "Brother: Andrie, Lola: Pilar");
  });
}

test("linking an existing profile preserves its attendance and creates no new member", async () => {
  const result = await application({ existing: true, edit: true, role: "son", noFamily: true, relativeName: "Andrie", rawRelative: true });
  assert.equal(result.status, 200);
  assert.equal(result.state.members.length, 2);
  assert.equal(result.state.members[1].household_id, 20);
  assert.deepEqual(result.state.members[1].attendance, ["2026-10-01"]);
  assert.deepEqual(result.state.households[0].family_members.at(-1), { member_id: 12, name: "Juan Santos", relationship: "Son", aliases: ["Andrie"] });
});

test("a stale or already registered relative cannot create another member", async () => {
  for (const options of [{ relativeName: "Missing", rawRelative: true }, { relativeName: "Andrie", linkedRelative: true }, { relativeName: "Andrie", rawRelative: true, sourceId: 999 }]) {
    const result = await application({ existing: true, role: "son", noFamily: true, ...options });
    assert.equal(result.status, 400);
    assert.equal(result.state.members.length, 1);
    assert.equal(result.committed, false);
  }
});

test("relative linking does not silently move a member from another household", async () => {
  const result = await application({ existing: true, edit: true, editHousehold: 99, role: "son", noFamily: true, relativeName: "Andrie" });
  assert.equal(result.status, 400);
  assert.equal(result.state.members[1].household_id, 99);
});

test("registering a parent with a corrected full name updates the parent field and keeps the original reference", async () => {
  const result = await application({ existing: true, role: "mother", noFamily: true, relativeName: "Maria Santos" });
  assert.equal(result.status, 201);
  assert.equal(result.state.households[0].mother_name, "Juan Santos");
  assert.deepEqual(result.state.households[0].family_members.at(-1), { member_id: 30, name: "Juan Santos", relationship: "Mother", aliases: ["Maria Santos"] });
});

test("a failed registration rolls back the relative conversion and leaves the original entry intact", async () => {
  const result = await application({ existing: true, failMember: true, role: "son", noFamily: true, relativeName: "Andrie" });
  assert.equal(result.status, 500);
  assert.equal(result.state.members.length, 1);
  assert.deepEqual(result.state.households[0].family_members.at(-1), { name: "Andrie", relationship: "Family Member", member_id: null });
});

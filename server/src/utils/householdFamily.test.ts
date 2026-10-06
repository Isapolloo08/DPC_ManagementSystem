import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../db/schema";
import { familyFields, linkHouseholdFamily, reflectHouseholdFamily, validateFamilyMembers, validateHouseholdParent, writeMemberWithParent } from "./householdFamily";

const father = { id: 1, household_id: 10, first_name: "Juan", last_name: "Santos", contact_phone: "09111111111" };
const mother = { id: 2, household_id: 10, first_name: "Maria", last_name: "Santos", contact_phone: "09222222222" };
const child = { id: 3, household_id: 10, first_name: "Ana", last_name: "Santos", guardian_names: "Old guardian", guardian_phone: "09333333333" };
const household = { id: 10, father_name: "Juan Santos", mother_name: "Maria Santos", guardian_name: "", primary_contact_phone: "09444444444" };

test("father has priority; absent father falls back to mother and then guardian", () => {
  assert.equal(familyFields(household, [mother, child, father], child).guardian_names, "Juan Santos");
  assert.equal(familyFields(household, [mother, child, father], child).guardian_phone, father.contact_phone);
  assert.equal(familyFields({ ...household, father_name: null }, [mother, child], child).guardian_names, "Maria Santos");
  assert.equal(familyFields({ ...household, father_name: null, mother_name: null, guardian_name: "Tita Rosa" }, [child], child).guardian_names, "Tita Rosa");
});

test("parents do not become their own or their spouse's guardian", () => {
  const parent = { ...mother, guardian_names: "Lola Pilar" };
  assert.equal(familyFields(household, [father, mother, child], parent).guardian_names, "Lola Pilar");
});

test("family summary contains nonmember parents once and sorts the remaining members", () => {
  const extra = { ...child, id: 4, first_name: "Ben" };
  const result = familyFields({ ...household, guardian_name: "Tita Rosa" }, [extra, mother, child, father], child);
  assert.equal(result.household_family_details, "Father: Juan Santos; Mother: Maria Santos; Guardian: Tita Rosa; Ana Santos; Ben Santos");
  assert.equal(familyFields({}, [], child).guardian_names, child.guardian_names);
});

test("a filtered member result reflects the complete family using batch queries", async () => {
  const originalAll = db.all;
  const calls: any[] = [];
  db.all = (async (query: string, params: any[]) => {
    calls.push(params);
    return query.includes("FROM households") ? [household] : [father, mother, child];
  }) as typeof db.all;
  try {
    const members = [{ ...child }];
    await reflectHouseholdFamily(members);
    assert.equal(members[0].guardian_names, "Juan Santos");
    assert.equal((members[0] as any).household_family_details, "Father: Juan Santos; Mother: Maria Santos; Ana Santos");
    assert.deepEqual(calls, [[[10]], [[10]]]);
  } finally {
    db.all = originalAll;
  }
});

test("household reflection preserves the child's original application relatives", async () => {
  const original = "Ate: Liza Santos, Kuya: Marco Santos, Mama: Maria Santos, Papa: Juan Santos";
  const member = { ...child, family_details: original };
  const result = familyFields(household, [father, mother, member], member);
  assert.equal(result.family_details, original);
  assert.equal(result.household_family_details, "Father: Juan Santos; Mother: Maria Santos; Ana Santos");

  const originalAll = db.all;
  db.all = (async (query: string) => query.includes("FROM households") ? [household] : [father, mother, member]) as typeof db.all;
  try {
    await reflectHouseholdFamily([member]);
    assert.equal(member.family_details, original);
    await reflectHouseholdFamily([member]);
    assert.equal(member.family_details, original);
  } finally {
    db.all = originalAll;
  }
});

test("invalid parent roles cannot become SQL identifiers or write a member", async () => {
  for (const parent of [{ role: "father_name = NULL", name: "Juan" }, { role: "mother", name: " " }, { role: "guardian", name: 10 }]) {
    assert.throws(() => validateHouseholdParent(parent, 10), (error: any) => error.status === 400);
  }
  await assert.rejects(writeMemberWithParent("unused", [], 10, { role: "unknown", name: "Juan" }), (error: any) => error.status === 400);
});

test("conflicting parent roles reject the application before any write", async () => {
  const originalTransaction = db.transaction;
  const queries: string[] = [];
  db.transaction = async callback => callback({ query: async (query: string) => {
    queries.push(query);
    return { rows: [household] };
  } } as any);
  try {
    await assert.rejects(writeMemberWithParent("INSERT INTO members", [], 10, { role: "mother", name: "Juan Santos" }), (error: any) => error.status === 400);
    assert.equal(queries.length, 1);
    assert.match(queries[0], /FOR UPDATE/);
  } finally {
    db.transaction = originalTransaction;
  }
});

test("custom relatives and linked relationships reflect once in family details", () => {
  const family = [
    { name: "Ana Santos", relationship: "Daughter", member_id: child.id },
    { name: "Ben Santos", relationship: "Son", member_id: null },
    { name: "Moved relative", relationship: "Relative", member_id: 99 }
  ];
  assert.equal(familyFields({ ...household, family_members: family }, [mother, father, child], child).household_family_details,
    "Father: Juan Santos; Mother: Maria Santos; Daughter: Ana Santos; Son: Ben Santos");
});

test("family entries validate names, relationships, ids, and duplicates", () => {
  assert.deepEqual(validateFamilyMembers([{ name: "  Ben Santos ", relationship: "Son" }]), [{ name: "Ben Santos", relationship: "Son", member_id: null }]);
  for (const family of [
    {}, [{ name: " " }], [{ name: "Ben", member_id: "4" }], [{ name: "Ben", relationship: 5 }],
    [{ name: "Ben Santos" }, { name: " ben  santos " }],
    [{ name: "Ben", member_id: 4 }, { name: "Benny", member_id: 4 }]
  ]) assert.throws(() => validateFamilyMembers(family), (error: any) => error.status === 400);
});

test("linking an unassigned member uses their current name and only changes selected member ids", async () => {
  const calls: { query: string; params: any[] }[] = [];
  const family = validateFamilyMembers([{ name: "Old name", relationship: "Son", member_id: 4 }]);
  const client = { query: async (query: string, params: any[]) => {
    calls.push({ query, params });
    return { rows: [{ id: 4, first_name: "Ben", last_name: "Santos", household_id: null }] };
  } };
  await linkHouseholdFamily(client, 10, family);
  assert.equal(family![0].name, "Ben Santos");
  assert.match(calls[0].query, /FOR UPDATE/);
  assert.equal(calls[1].query, "UPDATE members SET household_id = $1 WHERE id = ANY($2)");
  assert.deepEqual(calls[1].params, [10, [4]]);
});

test("members in another household cannot be silently reassigned", async () => {
  const queries: string[] = [];
  const client = { query: async (query: string) => {
    queries.push(query);
    return { rows: [{ ...father, household_id: 99 }] };
  } };
  await assert.rejects(linkHouseholdFamily(client, 10, validateFamilyMembers([{ name: "Juan Santos", member_id: 1 }])), (error: any) => error.status === 400);
  assert.equal(queries.length, 1);
});

import { test, expect, type Page } from "@playwright/test";
import {
  familyTreeLayout,
  relativeLabel,
} from "../../client/src/features/members/familyTreeLayout";
import type { FamilyPerson, FamilyRelationship } from "../../client/src/types";

const people: FamilyPerson[] = [
  {
    id: 1,
    stable_key: "1",
    member_id: 1,
    name: "Papa Santos",
    household_id: 1,
    household_name: "Parents household",
  },
  {
    id: 2,
    stable_key: "2",
    member_id: 2,
    name: "Mama Santos",
    household_id: 1,
    household_name: "Parents household",
  },
  {
    id: 3,
    stable_key: "3",
    member_id: 3,
    name: "Adult Santos",
    household_id: 2,
    household_name: "Adult household",
  },
  {
    id: 4,
    stable_key: "4",
    member_id: 4,
    name: "Liza Santos",
    household_id: 1,
    household_name: "Parents household",
  },
  {
    id: 5,
    stable_key: "5",
    member_id: 5,
    name: "Marco Santos",
    household_id: 1,
    household_name: "Parents household",
  },
];
const edges: FamilyRelationship[] = [
  { id: 1, from_person_id: 1, to_person_id: 2, kind: "spouse" },
  ...([3, 4, 5].flatMap((id, index) => [
    {
      id: index * 2 + 2,
      from_person_id: 1,
      to_person_id: id,
      kind: "parent",
      parent_role: "father",
    },
    {
      id: index * 2 + 3,
      from_person_id: 2,
      to_person_id: id,
      kind: "parent",
      parent_role: "mother",
    },
  ]) as FamilyRelationship[]),
];
async function prepare(page: Page, theme = "light", extended = false, adultMinistryId = 1) {
  const writes: { path: string; body: any; method: string }[] = [],
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const nodes = structuredClone(people),
    relationships = structuredClone(edges);
  if (extended) {
    nodes.push(
      {
        id: 8,
        stable_key: "8",
        member_id: null,
        name: "Lola Pilar",
        household_id: 1,
        household_name: "Parents household",
      },
      {
        id: 9,
        stable_key: "9",
        member_id: 9,
        name: "Unlinked Adult",
        household_id: 2,
        household_name: "Adult household",
      },
    );
    relationships.push({
      id: 8,
      from_person_id: 8,
      to_person_id: 1,
      kind: "parent",
      parent_role: "mother",
    });
  }
  const members = nodes
    .filter((p) => p.member_id)
    .map((p) => ({
      id: p.member_id,
      first_name: p.name.split(" ")[0],
      last_name: p.name.split(" ").slice(1).join(" "),
      household_id: p.household_id,
      birthdate: "1985-04-15",
      age: 41,
      gender: "Male",
      status: "active",
      ministry_id: p.member_id === 3 ? adultMinistryId : 1,
      ministry_name: p.member_id === 3 && adultMinistryId === 2 ? "Old Adult" : "Junior Adult",
      civil_status: "Widowed",
      address: "Daet, Camarines Norte",
      contact_phone: "0911111111" + p.member_id,
      baptism_status: "not_baptized",
    }));
  const households = [
    {
      id: 1,
      name: "Parents household",
      father_name: "Papa Santos",
      mother_name: "Mama Santos",
      address: "Parents address",
      family_members: [],
      members: members.filter((m) => m.household_id === 1),
    },
    {
      id: 2,
      name: "Adult household",
      father_name: "Adult Santos",
      address: "Adult address",
      family_members: [
        { member_id: 3, name: "Adult Santos", relationship: "Father" },
      ],
      members: members.filter((m) => m.household_id === 2),
    },
  ];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((theme) => {
    sessionStorage.setItem("dpc_intro_shown", "true");
    localStorage.setItem("dpc_help_welcome_v1:1:Admin", "seen");
    localStorage.setItem("dpc_theme_mode", theme);
    localStorage.setItem(
      "chms_token",
      "e30." + btoa(JSON.stringify({ exp: 4102444800 })) + ".test",
    );
  }, theme);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname,
      method = route.request().method();
    if (method !== "GET") {
      const body = route.request().postDataJSON();
      writes.push({ path, body, method });
      if (
        path === "/api/family/relationships" &&
        body.to.name === "New relative"
      ) {
        nodes.push({
          id: 10,
          stable_key: "10",
          member_id: null,
          name: "New relative",
          household_id: 2,
          household_name: "Adult household",
        });
        relationships.push({
          id: 10,
          from_person_id: body.from.person_id,
          to_person_id: 10,
          kind: body.kind,
          parent_role: body.parent_role,
        });
      }
      return route.fulfill({
        json: { id: 10, message: "Saved", household_id: 2 },
      });
    }
    let json: any = [];
    if (path.endsWith("/auth/setup-status"))
      json = { hasUsers: true, hasAdmin: true };
    else if (path.endsWith("/auth/me"))
      json = {
        user: {
          id: 1,
          name: "Preview",
          email: "family@example.test",
          role_name: "Admin",
          ministries: [],
        },
      };
    else if (path.endsWith("/reports/dashboard"))
      json = { metrics: {}, ministry_breakdown: [] };
    else if (path.endsWith("/settings/general"))
      json = { settings: {}, list: [] };
    else if (path.endsWith("/notifications"))
      json = { items: [], unread_count: 0 };
    else if (path.endsWith("/ministries"))
      json = [
        { id: 1, name: "Junior Adult", min_age: 36, max_age: 55 },
        { id: 2, name: "Old Adult", min_age: 56, max_age: 120 },
      ];
    else if (path.endsWith("/members")) json = members;
    else if (path.endsWith("/households")) json = households;
    else if (path.endsWith("/family/households/2/tree") || path.endsWith("/family/households/1/tree"))
      json = {
        household: path.endsWith('/1/tree') ? households[0] : households[1],
        people: new URL(route.request().url()).searchParams.get('scope') === 'extended' ? nodes : nodes.filter(p=>p.household_id===(path.endsWith('/1/tree')?1:2)),
        relationships: new URL(route.request().url()).searchParams.get('scope') === 'extended' ? relationships : relationships.filter(e=>[e.from_person_id,e.to_person_id].every(id=>nodes.find(p=>p.id===id)?.household_id===2)),
        legacy_suggestions: {
          father_name: "Adult Santos",
          family_members: extended
            ? [{ name: "Legacy Aunt", relationship: "Relative" }]
            : [],
        },
      };
    else if (path.endsWith("/family/members/3/parents"))
      json = {
        parents_household_id: 1,
        parents: [
          { person_id: 1, name: "Papa Santos", role: "father" },
          { person_id: 2, name: "Mama Santos", role: "mother" },
        ],
      };
    else if (path.endsWith("/members/3"))
      json = members.find((m) => m.id === 3);
    else if (path.endsWith("/members/check-duplicate"))
      json = { duplicateName: null };
    else if (path.endsWith("/members/birthdays"))
      json = { celebrants: [], counts: {} };
    else if (path.endsWith("/members/baptism-candidates/qualified"))
      json = { candidates: [], counts: {} };
    await route.fulfill({ json });
  });
  await page.goto("/");
  await page.getByTitle("Members & Families", { exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Adult Santos" }),
  ).toBeVisible();
  return { writes, errors, members };
}
async function openTree(page: Page, extendedView=true) {
  await page.getByRole("button", { name: /Households \(/ }).click();
  await page
    .getByRole("heading", { name: "Adult household", exact: true })
    .locator("../..")
    .locator("../..")
    .getByRole("button", { name: "View Family Tree", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Family Tree", exact: true });
  await expect(dialog).toBeVisible();
  if(extendedView) await dialog.getByRole('checkbox',{name:'Include linked parents & relatives'}).check();
  await expect(dialog.getByText("Loading family tree…")).toHaveCount(0);
  return dialog;
}
test("layout connects a couple above three children and derives family roles", () => {
  const layout = familyTreeLayout(people, edges),
    p = layout.positions;
  expect(p.get(1)!.y).toBe(p.get(2)!.y);
  for (const id of [3, 4, 5]) expect(p.get(id)!.y).toBeGreaterThan(p.get(1)!.y);
  expect(new Set([3, 4, 5].map((id) => p.get(id)!.x)).size).toBe(3);
  expect(relativeLabel(4, 3, edges)).toBe("Sibling");
  expect(relativeLabel(1, 3, edges)).toBe("father");
});

test('household tree starts local and optionally includes linked parents',async({page})=>{
  await prepare(page);
  const dialog=await openTree(page,false);
  const option=dialog.getByRole('checkbox',{name:'Include linked parents & relatives'});
  await expect(option).not.toBeChecked();
  await expect(dialog.getByText('This household only',{exact:false})).toBeVisible();
  await expect(dialog.getByRole('button').filter({hasText:'Adult Santos'})).toBeVisible();
  const summary = dialog.getByRole('region', { name: 'Households in this view' });
  await expect(summary).toContainText('This household · 1 person');
  await expect(summary).not.toContainText('Parents household');
  await expect(dialog.locator('[data-family-person="3"]')).toContainText('This household');
  await expect(dialog.getByRole('button').filter({hasText:'Papa Santos'})).toHaveCount(0);
  await option.check();
  await expect(dialog.getByRole('button').filter({hasText:'Papa Santos'})).toBeVisible();
  await expect(summary).toContainText('Other household · 4 people');
  await expect(summary).toContainText('Parents household');
  await expect(dialog.locator('[data-family-person="1"]')).toContainText('Other household');
  await expect(dialog.locator('[data-family-person="1"]')).toContainText('Parents household');
  await dialog.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(dialog.getByRole('region', { name: 'Adult household family members' })).toContainText('Adult Santos');
  await expect(dialog.getByRole('region', { name: 'Parents household family members' })).toContainText('Papa Santos');
  await expect(dialog.getByRole('region', { name: 'Parents household family members' })).not.toContainText('Adult Santos');
  await option.uncheck();
  await expect(dialog.getByRole('button').filter({hasText:'Papa Santos'})).toHaveCount(0);
  await expect(summary).not.toContainText('Parents household');
});
for (const theme of ["light", "dark"])
  test(`tree is readable, fullscreen and responsive (${theme})`, async ({
    page,
  }, info) => {
    const state = await prepare(page, theme),
      dialog = await openTree(page);
    await expect(
      dialog.getByRole("button").filter({ hasText: "Papa Santos" }),
    ).toBeVisible();
    const overlay = dialog.locator("..");
    const box = await overlay.boundingBox();
    expect(box!.x).toBe(0);
    expect(box!.width).toBe(1440);
    await page.screenshot({
      path: info.outputPath(`family-tree-${theme}-desktop.png`),
    });
    await dialog.getByRole("button", { name: "Zoom out", exact: true }).click();
    await expect(dialog.getByText("90%", { exact: true })).toBeVisible();
    await dialog
      .getByRole("button", { name: "Reset view", exact: true })
      .click();
    await expect(dialog.getByText("100%", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await dialog
      .getByRole("button", { name: "List view", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      dialog.getByRole("button", { name: "Close", exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: info.outputPath(`family-tree-${theme}-mobile.png`),
    });
    await dialog.getByRole("button", { name: "Close", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Close family tree" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(state.errors).toEqual([]);
    expect(state.writes).toEqual([]);
  });
test("tree derives grandparents, separates disconnected people, saves a named child and retains a failed draft", async ({
  page,
}) => {
  const state = await prepare(page, "light", true),
    dialog = await openTree(page);
  await dialog.getByRole("button", { name: "List view", exact: true }).click();
  await expect(dialog.getByText("Grandparent", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Relationships not yet recorded" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("region", {
      name: "Household names awaiting confirmation",
    }),
  ).toContainText("Legacy Aunt");
  await dialog
    .getByRole("button", { name: "Manage Relationships", exact: true })
    .click();
  const manager = dialog.getByRole("region", {
    name: "Manage family relationships",
  });
  await manager
    .getByRole("combobox", { name: "Add their", exact: true })
    .selectOption("child");
  await manager
    .getByLabel("Relative’s name", { exact: true })
    .fill("New relative");
  await manager
    .getByRole("button", { name: "Save relationship", exact: true })
    .click();
  await expect(
    dialog.getByText("Family relationship saved.", { exact: true }),
  ).toBeVisible();
  expect(state.writes[0].body).toMatchObject({
    from: { person_id: 3 },
    to: { name: "New relative", household_id: 2 },
    kind: "parent",
  });
  await page.route("**/api/family/relationships", (route) =>
    route.fulfill({
      status: 400,
      json: { error: "This link would create an ancestry cycle" },
    }),
  );
  await manager
    .getByLabel("Relative’s name", { exact: true })
    .fill("Draft relative");
  await manager
    .getByRole("button", { name: "Save relationship", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("ancestry cycle");
  await expect(
    manager.getByLabel("Relative’s name", { exact: true }),
  ).toHaveValue("Draft relative");
  expect(state.errors).toEqual([]);
});
test("adult edit retains own household while saving confirmed parent links", async ({
  page,
}) => {
  const state = await prepare(page);
  await page
    .getByRole("row")
    .filter({ hasText: "Adult Santos" })
    .getByTitle("Edit Member Record")
    .click();
  const dialog = page.getByRole("dialog", { name: "Edit Member", exact: true });
  const parents = dialog.getByRole("region", { name: "Parents’ household" });
  await expect(
    parents.getByRole("combobox", {
      name: "Parents’ registered household",
      exact: true,
    }),
  ).toHaveValue("1");
  await expect(parents.getByLabel("Registered parent 1")).toHaveValue(
    "recorded",
  );
  await expect(dialog.locator("[data-guide=member-household]")).toHaveValue(
    "2",
  );
  await dialog
    .getByRole("button", { name: "Type Manually", exact: true })
    .click();
  await dialog
    .getByPlaceholder(
      "e.g. Purok 4, Sitio Maligaya, Brgy. Bagang, Daet, Camarines Norte",
    )
    .fill("Purok 1, Daet, Camarines Norte");
  await dialog
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes[0].body.household_id).toBe(2);
  expect(state.writes[0].body.family_links).toEqual({
    parents_household_id: 1,
    parents: [
      { person_id: 1, role: "father" },
      { person_id: 2, role: "mother" },
    ],
  });
  expect(state.errors).toEqual([]);
});

for (const switchFromJunior of [false, true]) {
  test(`Old Adult saves without parent links${switchFromJunior ? ' after changing from Junior Adult' : ' on initial edit'}`, async ({ page }) => {
    const state = await prepare(page, 'light', false, switchFromJunior ? 1 : 2);
    if (!switchFromJunior) {
      await page.route('**/api/family/members/3/parents', route => route.fulfill({
        status: 500, json: { error: 'Parent links unavailable' },
      }));
    }
    await page.getByRole('row').filter({ hasText: 'Adult Santos' }).getByTitle('Edit Member Record').click();
    const dialog = page.getByRole('dialog', { name: 'Edit Member', exact: true });
    const parents = dialog.getByRole('region', { name: 'Parents’ household', exact: true });
    if (switchFromJunior) {
      await expect(parents.getByRole('combobox', { name: 'Parents’ registered household', exact: true })).toHaveValue('1');
      await dialog.locator('[data-guide="member-ministry"]').first().selectOption('2');
    }
    await expect(parents).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Type Manually', exact: true }).click();
    await dialog.getByPlaceholder('e.g. Purok 4, Sitio Maligaya, Brgy. Bagang, Daet, Camarines Norte').fill('Purok 1, Daet, Camarines Norte');
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].body.ministry_id).toBe(2);
    expect(state.writes[0].body.household_id).toBe(2);
    expect(state.writes[0].body).not.toHaveProperty('family_links');
    expect(state.errors).toEqual([]);
  });
}

test("relationship editing, removal confirmation and linking an unregistered relative use explicit actions", async ({
  page,
}) => {
  const state = await prepare(page, "light", true),
    dialog = await openTree(page);
  await dialog.getByRole("button", { name: "List view", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Manage Relationships", exact: true })
    .click();
  const manager = dialog.getByRole("region", {
    name: "Manage family relationships",
  });
  await dialog
    .getByRole("list", { name: "Recorded relationships" })
    .locator("li")
    .filter({ hasText: /Papa Santos.*father.*Adult Santos/ })
    .getByRole("button", { name: "Edit relationship", exact: true })
    .click();
  await manager
    .getByRole("combobox", { name: "Relationship to edit", exact: true })
    .selectOption("parent");
  await manager
    .getByRole("button", { name: "Save relationship changes", exact: true })
    .click();
  await expect(
    dialog.getByText("Family relationship saved.", { exact: true }),
  ).toBeVisible();
  expect(state.writes[0]).toMatchObject({
    path: "/api/family/relationships/2",
    method: "PUT",
    body: {
      from: { person_id: 1 },
      to: { person_id: 3 },
      kind: "parent",
      parent_role: "parent",
    },
  });
  await dialog
    .getByRole("button", { name: "Remove relationship 1", exact: true })
    .click();
  await manager.getByRole("button", { name: "Keep link", exact: true }).click();
  expect(state.writes).toHaveLength(1);
  await dialog
    .getByRole("button", { name: "Remove relationship 1", exact: true })
    .click();
  await manager
    .getByRole("button", { name: "Remove link", exact: true })
    .click();
  await expect(
    dialog.getByText("Relationship removed.", { exact: true }),
  ).toBeVisible();
  expect(state.writes[1].method).toBe("DELETE");
  await dialog.getByRole("button").filter({ hasText: "Lola Pilar" }).click();
  await manager
    .getByRole("combobox", { name: "Registered member", exact: true })
    .selectOption("5");
  await manager
    .getByRole("button", { name: "Confirm member link", exact: true })
    .click();
  await expect(
    dialog.getByText("Relative linked to registered member.", { exact: true }),
  ).toBeVisible();
  expect(state.writes[2]).toMatchObject({
    path: "/api/family/people/8/member",
    body: { member_id: 5 },
  });
  expect(state.errors).toEqual([]);
});
test("family tree loading failure offers retry", async ({ page }) => {
  const state = await prepare(page);
  let fail = true;
  await page.route("**/api/family/households/2/tree*", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { error: "Temporarily unavailable" } }
        : {
            json: {
              household: { id: 2, name: "Adult household" },
              people,
              relationships: edges,
            },
          },
    ),
  );
  await page.getByRole("button", { name: /Households \(/ }).click();
  await page
    .getByRole("button", { name: "View Family Tree", exact: true })
    .nth(1)
    .click();
  const dialog = page.getByRole("dialog", { name: "Family Tree", exact: true });
  await expect(dialog.getByRole("alert")).toContainText(
    "Temporarily unavailable",
  );
  fail = false;
  await dialog
    .getByRole("button", { name: "Retry family tree", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(dialog.getByText("Papa Santos", { exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test("new adult creates their own household and automatically records parents from their household", async ({
  page,
}, info) => {
  const state = await prepare(page);
  await page.getByRole("button", { name: "Add Member", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Add New Member Record",
    exact: true,
  });
  await dialog
    .getByPlaceholder("e.g. Mark Andrie M. Remot")
    .fill("New Adult Santos");
  await dialog.getByText("Select birthdate", { exact: true }).click();
  const calendar = page
    .getByTitle("Previous Month", { exact: true })
    .locator("../..");
  await calendar.getByRole("button", { name: /^\d{4}$/ }).click();
  await calendar.getByRole("button", { name: "1990", exact: true }).click();
  await calendar.getByRole("button", { name: "15", exact: true }).click();
  await dialog.getByRole("button", { name: /Widowed/ }).click();
  await dialog.locator('[data-guide="member-ministry"]').first().selectOption('1');
  await dialog
    .getByRole("button", { name: "Type Manually", exact: true })
    .click();
  await dialog
    .getByPlaceholder(
      "e.g. Purok 4, Sitio Maligaya, Brgy. Bagang, Daet, Camarines Norte",
    )
    .fill("Purok 1, Daet, Camarines Norte");
  await dialog
    .getByPlaceholder("e.g. 09123456789", { exact: true })
    .fill("09122222222");
  await dialog.getByRole("button", { name: "Create New", exact: true }).click();
  const parents = dialog.getByRole("region", { name: "Parents’ household" });
  await parents
    .getByRole("combobox", {
      name: "Parents’ registered household",
      exact: true,
    })
    .selectOption("1");
  await expect(parents.locator('[aria-label="Recorded parents"]')).toContainText('Papa Santos');
  await expect(parents.locator('[aria-label="Recorded parents"]')).toContainText('Mama Santos');
  await expect(parents.getByRole('button',{name:/Confirm/})).toHaveCount(0);
  expect(state.writes).toEqual([]);
  await parents.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("adult-parents-household-form.png"),
  });
  await dialog
    .getByRole("button", { name: "Save Application Record", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes[0].body.household_registration.mode).toBe("create");
  expect(state.writes[0].body.household_id).toBeNull();
  expect(state.writes[0].body.family_links).toEqual({
    parents_household_id: 1,
    parents: [
      { person_id: 1, role: "father" },
      { person_id: 2, role: "mother" },
    ],
  });
  expect(state.errors).toEqual([]);
});

import type { PoolClient } from "pg";

export type FamilyKind = "parent" | "guardian" | "spouse";
export interface PersonInput {
  person_id?: number;
  member_id?: number;
  name?: string;
  household_id?: number | null;
}
export interface FamilyLinksInput {
  parents_household_id: number | null;
  parents: (PersonInput & { role: "father" | "mother" | "parent" })[];
}
export function invalidFamily(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}
const positive = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) > 0;
export const lockFamily = (client: PoolClient) =>
  client.query("SELECT pg_advisory_xact_lock(170017)");

export async function resolvePerson(
  client: PoolClient,
  input: PersonInput,
): Promise<number> {
  if (!input || typeof input !== "object")
    invalidFamily("Choose a family person");
  const choices = [
    input.person_id != null,
    input.member_id != null,
    input.name != null,
  ].filter(Boolean).length;
  if (choices !== 1)
    invalidFamily("Select one registered person or enter one relative name");
  if (input.person_id != null) {
    if (!positive(input.person_id)) invalidFamily("Invalid family person");
    const row = (
      await client.query(
        "SELECT id FROM family_people WHERE id=$1 AND merged_into_id IS NULL",
        [input.person_id],
      )
    ).rows[0];
    if (!row) invalidFamily("This family person no longer exists");
    return row.id;
  }
  if (input.member_id != null) {
    if (!positive(input.member_id)) invalidFamily("Invalid church member");
    const member = (
      await client.query(
        "SELECT id, first_name, last_name FROM members WHERE id=$1",
        [input.member_id],
      )
    ).rows[0];
    if (!member) invalidFamily("This church member no longer exists");
    return (
      await client.query(
        `INSERT INTO family_people(member_id,name) VALUES($1,$2)
      ON CONFLICT(member_id) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [member.id, `${member.first_name} ${member.last_name}`.trim()],
      )
    ).rows[0].id;
  }
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.trim().length > 255
  )
    invalidFamily("Enter a relative name of up to 255 characters");
  if (input.household_id != null) {
    if (
      !positive(input.household_id) ||
      !(
        await client.query("SELECT id FROM households WHERE id=$1", [
          input.household_id,
        ])
      ).rows.length
    )
      invalidFamily("Parents’ household no longer exists");
  }
  return (
    await client.query(
      "INSERT INTO family_people(name,household_id) VALUES($1,$2) RETURNING id",
      [input.name.trim(), input.household_id || null],
    )
  ).rows[0].id;
}

async function spouseFields(
  client: PoolClient,
  from: number,
  to: number,
  remove = false,
) {
  const rows = (
    await client.query(
      `SELECT p.id,p.member_id, COALESCE(trim(m.first_name || ' ' || m.last_name),p.name) AS name
    FROM family_people p LEFT JOIN members m ON m.id=p.member_id WHERE p.id=ANY($1)`,
      [[from, to]],
    )
  ).rows;
  for (const person of rows)
    if (person.member_id) {
      const partner = rows.find((p) => p.id !== person.id)!;
      await client.query(
        `UPDATE members SET spouse_id=$1,spouse_name=$2${remove ? "" : ",civil_status='Married'"} WHERE id=$3`,
        [
          remove ? null : partner.member_id,
          remove ? null : partner.name,
          person.member_id,
        ],
      );
    }
}

export async function addRelationship(
  client: PoolClient,
  from: number,
  to: number,
  kind: FamilyKind,
  role?: string,
  allowExisting = false,
) {
  if (!positive(from) || !positive(to) || from === to)
    invalidFamily("A person cannot be related to themselves");
  if (!["parent", "guardian", "spouse"].includes(kind))
    invalidFamily("Choose a parent, guardian, or spouse relationship");
  if (kind === "parent" && !["father", "mother", "parent"].includes(role || ""))
    invalidFamily("Choose a parent role");
  if (kind === "spouse" && from > to) [from, to] = [to, from];
  if (
    (
      await client.query("SELECT id FROM family_people WHERE id=ANY($1)", [
        [from, to],
      ])
    ).rows.length !== 2
  )
    invalidFamily("A selected family person no longer exists");
  const edges = (
    await client.query(
      "SELECT * FROM family_relationships WHERE deleted_at IS NULL",
    )
  ).rows;
  const existing = edges.find(
    (e) =>
      e.from_person_id === from && e.to_person_id === to && e.kind === kind,
  );
  if (existing) {
    if (allowExisting && (kind !== "parent" || existing.parent_role === role))
      return existing.id;
    invalidFamily(
      "This relationship is already recorded. Edit the existing relationship instead.",
    );
  }
  if (kind === "parent") {
    if (
      edges.some(
        (e) =>
          e.kind === "spouse" &&
          ((e.from_person_id === from && e.to_person_id === to) ||
            (e.from_person_id === to && e.to_person_id === from)),
      )
    )
      invalidFamily("Spouses cannot also be a parent and child");
    const seen = new Set<number>();
    const pending = [to];
    while (pending.length) {
      const current = pending.pop()!;
      if (current === from)
        invalidFamily("This link would create an ancestry cycle");
      if (seen.has(current)) continue;
      seen.add(current);
      pending.push(
        ...edges
          .filter((e) => e.kind === "parent" && e.from_person_id === current)
          .map((e) => e.to_person_id),
      );
    }
    if (
      role !== "parent" &&
      edges.some(
        (e) =>
          e.kind === "parent" &&
          e.to_person_id === to &&
          e.parent_role === role,
      )
    )
      invalidFamily(
        `A ${role} is already recorded. Edit or remove that link first.`,
      );
  }
  if (kind === "spouse") {
    if (
      edges.some(
        (e) =>
          e.kind === "spouse" &&
          [e.from_person_id, e.to_person_id].some(
            (id) => id === from || id === to,
          ),
      )
    )
      invalidFamily("A spouse is already recorded. Remove that link first.");
    // Reject a spouse link anywhere along a confirmed ancestor/descendant path.
    for (const [start, finish] of [
      [from, to],
      [to, from],
    ]) {
      const pending = [start],
        seen = new Set<number>();
      while (pending.length) {
        const id = pending.pop()!;
        if (id === finish)
          invalidFamily("An ancestor and descendant cannot be spouses");
        if (seen.has(id)) continue;
        seen.add(id);
        pending.push(
          ...edges
            .filter((e) => e.kind === "parent" && e.from_person_id === id)
            .map((e) => e.to_person_id),
        );
      }
    }
  }
  const row = (
    await client.query(
      `INSERT INTO family_relationships(from_person_id,to_person_id,kind,parent_role)
    VALUES($1,$2,$3,$4) ON CONFLICT(from_person_id,to_person_id,kind) DO UPDATE SET deleted_at=NULL,parent_role=EXCLUDED.parent_role,source_household_id=NULL,source_removed=FALSE RETURNING id`,
      [from, to, kind, kind === "parent" ? role : null],
    )
  ).rows[0];
  if (kind === "spouse") await spouseFields(client, from, to);
  return row.id;
}

export async function removeRelationship(client: PoolClient, id: number) {
  const edge = (
    await client.query(
      "UPDATE family_relationships SET deleted_at=CURRENT_TIMESTAMP,source_removed=FALSE WHERE id=$1 AND deleted_at IS NULL RETURNING *",
      [id],
    )
  ).rows[0];
  if (!edge) invalidFamily("This relationship no longer exists");
  if (edge.kind === "spouse")
    await spouseFields(client, edge.from_person_id, edge.to_person_id, true);
  return edge;
}

export async function saveFamilyLinks(
  client: PoolClient,
  memberId: number,
  input: FamilyLinksInput | undefined,
) {
  if (input === undefined) return;
  await lockFamily(client);
  if (!input || !Array.isArray(input.parents) || input.parents.length > 10)
    invalidFamily("Provide a valid parent list");
  if (
    input.parents_household_id != null &&
    (!positive(input.parents_household_id) ||
      !(
        await client.query("SELECT id FROM households WHERE id=$1", [
          input.parents_household_id,
        ])
      ).rows.length)
  )
    invalidFamily("Parents’ household no longer exists");
  const child = await resolvePerson(client, { member_id: memberId });
  const parents = [];
  for (const parent of input.parents) {
    if (!["father", "mother", "parent"].includes(parent.role))
      invalidFamily("Choose a valid parent role");
    const { role, ...person } = parent;
    parents.push({
      id: await resolvePerson(client, {
        ...person,
        ...(person.name ? { household_id: input.parents_household_id } : {}),
      }),
      role,
    });
  }
  if (new Set(parents.map((p) => p.id)).size !== parents.length)
    invalidFamily("A parent is selected more than once");
  await client.query(
    "UPDATE family_relationships SET deleted_at=CURRENT_TIMESTAMP WHERE to_person_id=$1 AND kind='parent' AND deleted_at IS NULL",
    [child],
  );
  for (const parent of parents)
    await addRelationship(client, parent.id, child, "parent", parent.role);
  await client.query("UPDATE members SET parents_household_id=$1 WHERE id=$2", [
    input.parents_household_id,
    memberId,
  ]);
}

export async function syncMemberSpouse(client: PoolClient, memberId: number) {
  await lockFamily(client);
  const person = await resolvePerson(client, { member_id: memberId });
  const member = (
    await client.query(
      "SELECT spouse_id,spouse_name FROM members WHERE id=$1",
      [memberId],
    )
  ).rows[0];
  // Legacy name-only spouses need confirmation; do not infer an identity.
  const existing = (
    await client.query(
      "SELECT r.*,p.member_id AS partner_member_id,p.name AS partner_name FROM family_relationships r JOIN family_people p ON p.id=CASE WHEN r.from_person_id=$1 THEN r.to_person_id ELSE r.from_person_id END WHERE r.deleted_at IS NULL AND r.kind='spouse' AND (r.from_person_id=$1 OR r.to_person_id=$1)",
      [person],
    )
  ).rows;
  for (const edge of existing)
    if (
      edge.partner_member_id
        ? edge.partner_member_id !== member.spouse_id
        : member.spouse_id || edge.partner_name !== member.spouse_name
    )
      await client.query(
        "UPDATE family_relationships SET deleted_at=CURRENT_TIMESTAMP WHERE id=$1",
        [edge.id],
      );
  if (member.spouse_id) {
    const partner = await resolvePerson(client, {
      member_id: member.spouse_id,
    });
    await addRelationship(client, person, partner, "spouse", undefined, true);
  }
}

export async function linkFamilyPerson(
  client: PoolClient,
  personId: number,
  memberId: number,
) {
  await lockFamily(client);
  const original = (
    await client.query("SELECT * FROM family_people WHERE id=$1", [personId])
  ).rows[0];
  if (!original || original.member_id || original.merged_into_id)
    invalidFamily("Choose an unregistered relative");
  const target = await resolvePerson(client, { member_id: memberId });
  const edges = (
    await client.query(
      "SELECT * FROM family_relationships WHERE deleted_at IS NULL AND (from_person_id=$1 OR to_person_id=$1)",
      [personId],
    )
  ).rows;
  await client.query(
    "UPDATE family_relationships SET deleted_at=CURRENT_TIMESTAMP WHERE from_person_id=$1 OR to_person_id=$1",
    [personId],
  );
  for (const edge of edges) {
    const newId = await addRelationship(
      client,
      edge.from_person_id === personId ? target : edge.from_person_id,
      edge.to_person_id === personId ? target : edge.to_person_id,
      edge.kind,
      edge.parent_role,
      true,
    );
    if (edge.source_household_id) await client.query("UPDATE family_relationships SET source_household_id=$1,source_removed=$2 WHERE id=$3", [edge.source_household_id, edge.source_removed, newId]);
  }
  await client.query("UPDATE family_people SET merged_into_id=$1 WHERE id=$2", [
    target,
    personId,
  ]);
  return target;
}

export const peopleProjection = `SELECT p.id,p.stable_key,p.member_id,COALESCE(trim(m.first_name || ' ' || m.last_name),p.name) AS name,
  COALESCE(m.household_id,p.household_id) AS household_id,h.name AS household_name,m.photo_url,m.birthdate,m.ministry_id
  FROM family_people p LEFT JOIN members m ON m.id=p.member_id
  LEFT JOIN households h ON h.id=COALESCE(m.household_id,p.household_id)`;

import type { PoolClient } from "pg";
import { addRelationship, invalidFamily, lockFamily } from "./familyTree";

/** Restore graph identities independently of serial IDs; never skip an incompatible edge. */
export async function restoreFamilyGraph(
  client: PoolClient,
  people: unknown,
  relationships: unknown,
) {
  if (people === undefined && relationships === undefined) return;
  if (!Array.isArray(people) || !Array.isArray(relationships))
    invalidFamily("Family backup needs both people and relationships");
  await lockFamily(client);
  const mapping = new Map<number, number>();
  for (const person of people) {
    if (
      !Number.isSafeInteger(person.id) ||
      person.id <= 0 ||
      mapping.has(person.id) ||
      typeof person.stable_key !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(person.stable_key) ||
      typeof person.name !== "string" ||
      !person.name.trim()
    )
      invalidFamily("Invalid family person in backup");
    const matches = (
      await client.query(
        "SELECT id FROM family_people WHERE stable_key=$1 OR (member_id=$2 AND $2 IS NOT NULL) OR (household_id=$3 AND household_entry_key=$4 AND $4 IS NOT NULL)",
        [
          person.stable_key,
          person.member_id || null,
          person.household_id || null,
          person.household_entry_key || null,
        ],
      )
    ).rows;
    if (matches.length > 1)
      invalidFamily(
        "Conflicting family identities in backup. No restore was committed.",
      );
    let id = matches[0]?.id;
    if (id)
      await client.query(
        "UPDATE family_people SET name=$1,household_id=$2,household_entry_key=$4 WHERE id=$3",
        [
          person.name,
          person.household_id || null,
          id,
          person.household_entry_key || null,
        ],
      );
    else
      id = (
        await client.query(
          "INSERT INTO family_people(stable_key,member_id,name,household_id,household_entry_key) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [
            person.stable_key,
            person.member_id || null,
            person.name,
            person.household_id || null,
            person.household_entry_key || null,
          ],
        )
      ).rows[0].id;
    mapping.set(person.id, id);
  }
  for (const person of people)
    if (person.merged_into_id) {
      const target = mapping.get(person.merged_into_id);
      if (!target)
        invalidFamily("A merged relative references a missing backup person");
      await client.query(
        "UPDATE family_people SET merged_into_id=$1 WHERE id=$2",
        [target, mapping.get(person.id)],
      );
    }
  for (const edge of [...relationships].sort(
    (a, b) => Number(!!b.deleted_at) - Number(!!a.deleted_at),
  )) {
    const from = mapping.get(edge.from_person_id),
      to = mapping.get(edge.to_person_id);
    if (!from || !to)
      invalidFamily("A family relationship references a missing backup person");
    if (edge.deleted_at) {
      const pair =
        edge.kind === "spouse" && from > to ? [to, from] : [from, to];
      await client.query(
        `INSERT INTO family_relationships(from_person_id,to_person_id,kind,parent_role,deleted_at) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(from_person_id,to_person_id,kind) DO UPDATE SET deleted_at=EXCLUDED.deleted_at`,
        [...pair, edge.kind, edge.parent_role, edge.deleted_at],
      );
    } else
      await addRelationship(
        client,
        from,
        to,
        edge.kind,
        edge.parent_role,
        true,
      );
    await client.query(
      "UPDATE family_relationships SET source_household_id=$1,source_removed=$2 WHERE from_person_id=$3 AND to_person_id=$4 AND kind=$5",
      [
        edge.source_household_id || null,
        edge.source_removed === true,
        edge.kind === "spouse" ? Math.min(from, to) : from,
        edge.kind === "spouse" ? Math.max(from, to) : to,
        edge.kind,
      ],
    );
  }
}

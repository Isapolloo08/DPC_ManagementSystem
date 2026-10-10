import { db } from "../db/schema";

const roles = ["father", "mother", "guardian"] as const;
const householdRelationships: Record<string, string> = {
  husband: "Husband", wife: "Wife",
  father: "Father", mother: "Mother", guardian: "Guardian",
  son: "Son", daughter: "Daughter", child: "Child",
  grandfather: "Grandfather", grandmother: "Grandmother", grandparent: "Grandparent",
  grandson: "Grandson", granddaughter: "Granddaughter", grandchild: "Grandchild",
  brother: "Brother", sister: "Sister", sibling: "Sibling", spouse: "Spouse",
  relative: "Relative", family_member: "Family Member", other: "Other"
};
const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
const fullName = (member: any) => `${member.first_name || ""} ${member.last_name || ""}`.trim();

export function familyFields(household: any, members: any[], member: any) {
  const parents = roles.flatMap(role => household[`${role}_name`]?.trim()
    ? [{ role, name: household[`${role}_name`].trim() }] : []);
  const isParent = parents.some(parent => normalize(parent.name) === normalize(fullName(member)));
  const parentMember = members.find(m => normalize(fullName(m)) === normalize(parents[0]?.name || ""));
  const saved = household.family_members || [];
  const entries = members.map(m => ({
    name: fullName(m),
    relationship: saved.find(entry => entry.member_id === m.id || (!entry.member_id && normalize(entry.name) === normalize(fullName(m))))?.relationship || "Family Member"
  }));
  const names = new Set(entries.map(entry => normalize(entry.name)));
  entries.push(...saved.filter(entry => !entry.member_id && !names.has(normalize(entry.name))));
  const others = entries.filter(entry => !parents.some(parent => normalize(parent.name) === normalize(entry.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const summary = [...parents.map(p => `${p.role[0].toUpperCase()}${p.role.slice(1)}: ${p.name}`),
    ...others.map(entry => entry.relationship === "Family Member" ? entry.name : `${entry.relationship}: ${entry.name}`)].join("; ");
  return {
    guardian_names: !isParent && parents.length ? parents[0].name : member.guardian_names,
    guardian_phone: !isParent && parents.length ? parentMember?.contact_phone || member.guardian_phone || household.primary_contact_phone : member.guardian_phone,
    // The application text is independent of the household's derived family list.
    // Replacing it here also causes a later profile save to erase original relatives.
    household_family_details: summary,
    family_details: member.family_details
  };
}

// Batch complete households, even when the directory is paginated or ministry-filtered.
export async function reflectHouseholdFamily(members: any[]) {
  const ids = [...new Set(members.map(m => m.household_id).filter(Boolean))];
  if (!ids.length) return;
  const [households, relatives] = await Promise.all([
    db.all("SELECT * FROM households WHERE id = ANY($1)", [ids]),
    db.all("SELECT id, household_id, first_name, last_name, contact_phone FROM members WHERE household_id = ANY($1)", [ids])
  ]);
  const byId = new Map(households.map(h => [h.id, h]));
  const relativesById = new Map<number, any[]>();
  for (const relative of relatives) {
    if (!relativesById.has(relative.household_id)) relativesById.set(relative.household_id, []);
    relativesById.get(relative.household_id)!.push(relative);
  }
  for (const member of members) {
    const household = byId.get(member.household_id);
    if (household) Object.assign(member, familyFields(household, relativesById.get(household.id) || [], member));
  }
}

function invalid(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

export function validateFamilyMembers(value: any): { name: string; relationship: string; member_id: number | null; aliases?: string[] }[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 500) invalid("Please provide a valid family member list (up to 500 people)");
  const names = new Set<string>();
  const ids = new Set<number>();
  return value.map(entry => {
    if (!entry || typeof entry.name !== "string" || !entry.name.trim() || entry.name.trim().length > 255) invalid("Each family member needs a name with at most 255 characters");
    if (entry.relationship !== undefined && (typeof entry.relationship !== "string" || !entry.relationship.trim() || entry.relationship.trim().length > 100)) invalid("Please enter a valid family relationship");
    if (entry.member_id != null && (!Number.isSafeInteger(entry.member_id) || entry.member_id <= 0)) invalid("Invalid registered family member");
    if (entry.aliases !== undefined && (!Array.isArray(entry.aliases) || entry.aliases.length > 20 || entry.aliases.some((alias: any) => typeof alias !== "string" || !alias.trim() || alias.trim().length > 255))) invalid("Invalid family entry aliases");
    const name = normalize(entry.name);
    if (names.has(name) || (entry.member_id != null && ids.has(entry.member_id))) invalid("This family member is already in the list");
    names.add(name);
    if (entry.member_id != null) ids.add(entry.member_id);
    return { name: entry.name.trim(), relationship: entry.relationship?.trim() || "Family Member", member_id: entry.member_id ?? null,
      ...(entry.aliases?.length ? { aliases: [...new Set<string>(entry.aliases.map((alias: string) => alias.trim()))] } : {}) };
  });
}

export async function linkHouseholdFamily(client: any, householdId: number, entries: ReturnType<typeof validateFamilyMembers>) {
  if (!entries) return;
  const ids = entries.flatMap(entry => entry.member_id ? [entry.member_id] : []);
  if (!ids.length) return;
  const result = await client.query("SELECT id, first_name, last_name, household_id FROM members WHERE id = ANY($1) ORDER BY id FOR UPDATE", [ids]);
  if (result.rows.length !== ids.length) invalid("One of the selected church members no longer exists");
  for (const member of result.rows) {
    if (member.household_id && Number(member.household_id) !== Number(householdId)) invalid(`${fullName(member)} already belongs to another household. Update their member record first.`);
    entries.find(entry => entry.member_id === member.id)!.name = fullName(member);
  }
  validateFamilyMembers(entries);
  // Adding family members never deletes or unlinks an existing member record.
  await client.query("UPDATE members SET household_id = $1 WHERE id = ANY($2)", [householdId, ids]);
}

// Household editing replaces the roster. Member registration remains additive.
// Clearing an assignment must not delete the profile or its family relationships.
export async function replaceHouseholdFamily(client: any, householdId: number, entries: ReturnType<typeof validateFamilyMembers>) {
  if (entries === undefined) return;
  await linkHouseholdFamily(client, householdId, entries);
  const household = (await client.query("SELECT father_name,mother_name,guardian_name FROM households WHERE id=$1", [householdId])).rows[0];
  const members = (await client.query("SELECT id,first_name,last_name FROM members WHERE household_id=$1 ORDER BY id FOR UPDATE", [householdId])).rows;
  const retained = new Set(entries.flatMap(entry => entry.member_id ? [entry.member_id] : []));
  // Older clients may supply parent names without IDs. Preserve only unique matches.
  for (const role of roles) {
    const name = normalize(household?.[`${role}_name`] || "");
    if (!name) continue;
    const matches = members.filter((member: any) => normalize(fullName(member)) === name);
    if (matches.length === 1) retained.add(matches[0].id);
  }
  const removed = members.filter((member: any) => !retained.has(member.id)).map((member: any) => member.id);
  if (removed.length) await client.query("UPDATE members SET household_id=NULL WHERE household_id=$1 AND id=ANY($2::integer[])", [householdId, removed]);
}

export function validateHouseholdParent(parent: any, householdId: any) {
  if (parent === undefined) return;
  if (!householdId || !parent || !roles.includes(parent.role) || typeof parent.name !== "string" || !parent.name.trim() || parent.name.trim().length > 255) {
    invalid("Choose a household and a valid father, mother, or guardian name");
  }
}

// Keep the relationship and main member write atomic. Role names are a fixed allowlist.
export async function writeMemberWithParent(query: string, params: any[], householdId: any, parent: any, previousMember?: any, transactionClient?: any) {
  validateHouseholdParent(parent, householdId);
  const write = async (client: any) => {
    if (parent) {
      const result = await client.query("SELECT * FROM households WHERE id = $1 FOR UPDATE", [householdId]);
      const household = result.rows[0];
      if (!household) invalid("Household not found");
      if (roles.some(role => role !== parent.role && normalize(household[`${role}_name`] || "") === normalize(parent.name))) {
        invalid("This person already has a different parent/guardian role. Update the household to change it.");
      }
      await client.query(`UPDATE households SET ${parent.role}_name = $1 WHERE id = $2`, [parent.name.trim(), householdId]);
    }
    const result = await client.query(query, params);
    // A registered parent's name follows corrections to their member record.
    if (previousMember?.household_id && normalize(fullName(previousMember)) !== normalize(`${params[0]} ${params[1]}`)) {
      await client.query(`UPDATE households SET
        father_name = CASE WHEN LOWER(TRIM(father_name)) = LOWER($1) THEN $2 ELSE father_name END,
        mother_name = CASE WHEN LOWER(TRIM(mother_name)) = LOWER($1) THEN $2 ELSE mother_name END,
        guardian_name = CASE WHEN LOWER(TRIM(guardian_name)) = LOWER($1) THEN $2 ELSE guardian_name END
        WHERE id = $3`, [fullName(previousMember), `${params[0]} ${params[1]}`, previousMember.household_id]);
    }
    return { lastInsertRowid: result.rows[0]?.id || null, changes: result.rowCount || 0 };
  };
  return transactionClient ? write(transactionClient) : db.transaction(write);
}

// The application joins existing member IDs; their attendance and profile data stay intact.
export async function prepareMemberHousehold(client: any, registration: any, member: any) {
  if (!registration || !["create", "existing"].includes(registration.mode)) invalid("Choose a valid household registration mode");
  const role = registration.role || null;
  const slot = role === 'husband' ? 'father' : role === 'wife' ? 'mother' : role;
  if (role && !Object.hasOwn(householdRelationships, role)) invalid("Choose a valid relationship in this household");
  const family = validateFamilyMembers(registration.family_members) || [];
  if (family.some(entry => !entry.member_id || entry.member_id === member.id)) invalid("Select existing family members other than this member");
  if (family.length && !role) invalid("Choose your role in the household before linking family members");
  let household: any;
  if (registration.mode === "create") {
    if (typeof registration.name !== "string" || !registration.name.trim() || registration.name.trim().length > 255) invalid("Household name is required (up to 255 characters)");
    const duplicate = await client.query("SELECT id FROM households WHERE LOWER(name) = LOWER($1)", [registration.name.trim()]);
    if (duplicate.rows.length) invalid("A household with this name already exists. Select the existing household instead.");
    const result = await client.query(`INSERT INTO households (name, address, primary_contact_phone)
      VALUES ($1, $2, $3) RETURNING *`, [registration.name.trim(), member.address || null, member.contact_phone || null]);
    household = result.rows[0];
  } else {
    if (!Number.isSafeInteger(registration.household_id) || registration.household_id <= 0) invalid("Choose an existing household");
    const result = await client.query("SELECT * FROM households WHERE id = $1 FOR UPDATE", [registration.household_id]);
    household = result.rows[0];
    if (!household) invalid("Household not found");
  }
  if (registration.relative) await validateRelativeRegistration(client, household, registration, member);
  const name = fullName(member);
  if (slot && roles.includes(slot)) {
    const current = household[`${slot}_name`];
    if (current?.trim() && ![name, member.previous_name || "", registration.relative?.name || ""].some(candidate => normalize(current) === normalize(candidate))) invalid(`This household already has a ${role}: ${current}. Update the household first.`);
    if (roles.some(other => other !== slot && normalize(household[`${other}_name`] || "") === normalize(name))) invalid("This person already has a different parent/guardian role. Update the household first.");
    await client.query(`UPDATE households SET ${slot}_name = $1 WHERE id = $2`, [name, household.id]);
  } else if (role && roles.some(parent => [name, member.previous_name || ""].some(candidate => candidate &&
    normalize(household[`${parent}_name`] || "") === normalize(candidate)))) {
    invalid("This person already has a parent/guardian role. Update the household to change it first.");
  }
  await linkHouseholdFamily(client, household.id, family);
  if (family.length) {
    // Merge selected relationships without dropping existing relatives or members.
    const merged = (household.family_members || []).filter((entry: any) => !family.some(selected =>
      selected.member_id === entry.member_id || normalize(selected.name) === normalize(entry.name)));
    merged.push(...family);
    validateFamilyMembers(merged);
    await client.query("UPDATE households SET family_members = $1::jsonb WHERE id = $2", [JSON.stringify(merged), household.id]);
  }
  return household.id as number;
}

// The new member ID is available only after the member write. Store their
// relationship in the same transaction so the family list can resolve it on read.
export async function saveMemberHouseholdRelationship(client: any, householdId: number, registration: any, member: any) {
  const role = registration?.role;
  if (!role) return;
  if (!Object.hasOwn(householdRelationships, role)) invalid("Choose a valid relationship in this household");
  const household = (await client.query("SELECT * FROM households WHERE id = $1 FOR UPDATE", [householdId])).rows[0];
  if (!household) invalid("Household not found");
  const names = [fullName(member), member.previous_name, registration.relative?.name].filter(Boolean).map(normalize);
  const previousEntries = (household.family_members || []).filter((entry: any) => entry.member_id === member.id ||
    (!entry.member_id && names.includes(normalize(entry.name))));
  const aliases = [...new Set<string>([...previousEntries.flatMap((entry: any) => entry.aliases || []),
    ...(registration.relative ? [registration.relative.name] : [])])];
  const family = (household.family_members || []).filter((entry: any) =>
    entry.member_id !== member.id && !(!entry.member_id && names.includes(normalize(entry.name))));
  if (!roles.includes(role) || aliases.length) {
    family.push({ member_id: member.id, name: fullName(member), relationship: householdRelationships[role], ...(aliases.length ? { aliases } : {}) });
  } else if (family.length === (household.family_members || []).length) {
    return;
  }
  validateFamilyMembers(family);
  await client.query("UPDATE households SET family_members = $1::jsonb WHERE id = $2", [JSON.stringify(family), householdId]);
}

// Marriage is independent of parenthood. Only use the couple slots when one
// partner is already a household head; married children can live with parents.
export async function syncHouseholdSpouseRole(client: any, memberId: number) {
  const member = (await client.query("SELECT id,first_name,last_name,household_id,spouse_id FROM members WHERE id=$1", [memberId])).rows[0];
  if (!member?.household_id || !member.spouse_id) return;
  const partner = (await client.query("SELECT id,first_name,last_name,household_id FROM members WHERE id=$1", [member.spouse_id])).rows[0];
  if (!partner || Number(partner.household_id) !== Number(member.household_id)) return;
  const household = (await client.query("SELECT * FROM households WHERE id=$1 FOR UPDATE", [member.household_id])).rows[0];
  if (!household) return;
  const name = fullName(member), partnerName = fullName(partner);
  const father = normalize(household.father_name || ''), mother = normalize(household.mother_name || '');
  const memberSlot = father === normalize(name) ? 'father' : mother === normalize(name) ? 'mother' : null;
  const partnerSlot = father === normalize(partnerName) ? 'father' : mother === normalize(partnerName) ? 'mother' : null;
  let ownRole = 'Spouse', partnerRole = 'Spouse';
  if (memberSlot && (!household[`${memberSlot === 'father' ? 'mother' : 'father'}_name`] || partnerSlot)) {
    ownRole = memberSlot === 'father' ? 'Husband' : 'Wife';
    partnerRole = memberSlot === 'father' ? 'Wife' : 'Husband';
    if (!partnerSlot) await client.query(`UPDATE households SET ${memberSlot === 'father' ? 'mother' : 'father'}_name=$1 WHERE id=$2`, [partnerName, household.id]);
  } else if (partnerSlot && !household[`${partnerSlot === 'father' ? 'mother' : 'father'}_name`]) {
    ownRole = partnerSlot === 'father' ? 'Wife' : 'Husband';
    partnerRole = partnerSlot === 'father' ? 'Husband' : 'Wife';
    await client.query(`UPDATE households SET ${partnerSlot === 'father' ? 'mother' : 'father'}_name=$1 WHERE id=$2`, [name, household.id]);
  }
  const family = household.family_members || [];
  for (const [person, relationship] of [[member, ownRole], [partner, partnerRole]] as const) {
    const index = family.findIndex((entry: any) => entry.member_id === person.id || (!entry.member_id && normalize(entry.name) === normalize(fullName(person))));
    const entry = index >= 0 ? family[index] : {};
    if (relationship === 'Spouse' && entry.relationship && !['Spouse','Family Member'].includes(entry.relationship)) continue;
    const next = {...entry, member_id:person.id, name:fullName(person), relationship};
    if (index >= 0) family[index] = next; else family.push(next);
  }
  validateFamilyMembers(family);
  await client.query("UPDATE households SET family_members=$1::jsonb WHERE id=$2", [JSON.stringify(family),household.id]);
}

async function validateRelativeRegistration(client: any, household: any, registration: any, member: any) {
  const relative = registration.relative;
  if (registration.mode !== "existing" || !registration.role || !relative || typeof relative.name !== "string" || !relative.name.trim() || relative.name.trim().length > 255) invalid("Choose the relative's existing household and relationship");
  if (member.household_id && Number(member.household_id) !== Number(household.id)) invalid("This member already belongs to another household. Update their record first.");
  const sourceName = normalize(relative.name);
  const saved = (household.family_members || []).find((entry: any) => normalize(entry.name) === sourceName || (entry.aliases || []).some((alias: string) => normalize(alias) === sourceName));
  if (saved?.member_id && saved.member_id !== member.id) invalid("This relative is already linked to a registered member. Refresh the family list.");
  const parent = roles.find(role => normalize(household[`${role}_name`] || "") === sourceName);
  const slot = registration.role === 'husband' ? 'father' : registration.role === 'wife' ? 'mother' : registration.role;
  if (parent && parent !== slot) invalid("Keep the relative's existing parent/guardian relationship or update the household first.");
  if (saved || parent) return;
  if (!Number.isSafeInteger(relative.source_member_id) || relative.source_member_id <= 0) invalid("The original family entry is required");
  const source = (await client.query("SELECT id, household_id, family_details FROM members WHERE id = $1 FOR UPDATE", [relative.source_member_id])).rows[0];
  if (!source || Number(source.household_id) !== Number(household.id)) invalid("The original family entry does not belong to this household");
  const names = (source.family_details || "").split(/[;,\n\r]+/).map((part: string) => {
    const text = part.trim();
    return normalize(text.match(/^([^:-]+)[:\-]\s*(.+)$/)?.[2] || text);
  });
  if (!names.includes(sourceName)) invalid("This relative is no longer in the original family list. Refresh the record.");
}

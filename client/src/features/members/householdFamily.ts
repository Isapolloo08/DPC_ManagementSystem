import { Household, HouseholdFamilyMember, Member } from "../../types";

export type ParentRole = "father" | "mother" | "guardian";
export const parentRoles: ParentRole[] = ["father", "mother", "guardian"];
export const parentLabels: Record<string, string> = { father: "Father", mother: "Mother", guardian: "Guardian" };
export const householdRoleLabels = {
  husband: "Husband", wife: "Wife",
  father: "Father", mother: "Mother", guardian: "Guardian",
  son: "Son", daughter: "Daughter", child: "Child",
  grandfather: "Grandfather", grandmother: "Grandmother", grandparent: "Grandparent",
  grandson: "Grandson", granddaughter: "Granddaughter", grandchild: "Grandchild",
  brother: "Brother", sister: "Sister", sibling: "Sibling", spouse: "Spouse",
  relative: "Relative", family_member: "Family Member", other: "Other"
};
export type HouseholdRole = keyof typeof householdRoleLabels;
export const householdRoles = Object.keys(householdRoleLabels) as HouseholdRole[];
export const relationshipRole = (relationship: string): HouseholdRole =>
  householdRoles.find(role => normalizeName(householdRoleLabels[role]) === normalizeName(relationship)) || "family_member";
export const familyRelationships = ["Son", "Daughter", "Child", "Brother", "Sister", "Sibling", "Grandfather", "Grandmother", "Grandparent", "Grandson", "Granddaughter", "Grandchild", "Spouse", "Relative", "Family Member", "Other"];

export function memberHouseholdRole(household: Household | undefined, member: Member): HouseholdRole | "" {
  if (!household) return "";
  const couple = household.family_members?.find(entry => entry.member_id === member.id && ['Husband', 'Wife'].includes(entry.relationship));
  if (couple) return relationshipRole(couple.relationship);
  const parent = familyRole(household, memberName(member));
  if (parent && member.civil_status === 'Married' && parent !== 'guardian') return parent === 'father' ? 'husband' : 'wife';
  if (parent) return parent;
  const entry = household.family_members?.find(entry => entry.member_id === member.id ||
    (!entry.member_id && normalizeName(entry.name) === normalizeName(memberName(member))));
  return householdRoles.find(role => householdRoleLabels[role] === entry?.relationship) || "";
}
export const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
export const memberName = (member: Pick<Member, "first_name" | "last_name">) =>
  `${member.first_name || ""} ${member.last_name || ""}`.trim();

export function familyRole(household: Household, name: string): ParentRole | null {
  return parentRoles.find(role => household[`${role}_name`]?.trim() &&
    normalizeName(household[`${role}_name`]!) === normalizeName(name)) || null;
}

export function householdFamilyMembers(household?: Household | null): HouseholdFamilyMember[] {
  if (!household) return [];
  const members = household.members || [];
  const saved = household.family_members || [];
  const linked = members.map(member => {
    const entry = saved.find(entry => entry.member_id === member.id || (!entry.member_id && normalizeName(entry.name) === normalizeName(memberName(member))));
    const spouse = members.find(partner => partner.id === member.spouse_id || partner.spouse_id === member.id);
    const relationship = spouse && (!entry?.relationship || entry.relationship === 'Family Member') ? 'Spouse' : entry?.relationship || 'Family Member';
    return { name: memberName(member), member_id: member.id, relationship, ...(entry?.aliases?.length ? { aliases: entry.aliases } : {}) };
  });
  const names = new Set(linked.map(entry => normalizeName(entry.name)));
  const custom = saved.filter(entry => !entry.member_id && !names.has(normalizeName(entry.name)));
  return [...linked, ...custom];
}

export function householdFamily(household?: Household | null) {
  if (!household) return { primaryParent: "", primaryPhone: "", summary: "", entries: [] };
  const parents = parentRoles.flatMap(role => {
    const name = household[`${role}_name`]?.trim();
    if (!name) return [];
    const saved = household.family_members?.find(entry => [parentLabels[role], role === 'father' ? 'Husband' : role === 'mother' ? 'Wife' : 'Guardian'].includes(entry.relationship) &&
      (normalizeName(entry.name) === normalizeName(name) || household.members?.some(member =>
        member.id === entry.member_id && normalizeName(memberName(member)) === normalizeName(name))));
    const member = household.members?.find(m => saved?.member_id ? m.id === saved.member_id : normalizeName(memberName(m)) === normalizeName(name));
    const couple = household.family_members?.find(entry => ['Husband','Wife'].includes(entry.relationship) && (entry.member_id ? entry.member_id === member?.id : normalizeName(entry.name) === normalizeName(name)));
    return [{ name, role, relationship: couple?.relationship || parentLabels[role], member, aliases: saved?.aliases || [] }];
  });
  const others = householdFamilyMembers(household)
    .filter(entry => !familyRole(household, entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => ({ name: entry.name, relationship: entry.relationship, role: null as ParentRole | null, member: household.members?.find(member => member.id === entry.member_id), aliases: entry.aliases || [] }));
  const entries = [...parents, ...others];
  return {
    primaryParent: parents[0]?.name || "",
    primaryPhone: parents[0]?.member?.contact_phone || "",
    summary: entries.map(entry => entry.relationship !== "Family Member" ? `${entry.relationship}: ${entry.name}` : entry.name).join("; "),
    entries
  };
}

export function parseFamilyDetailsText(text?: string | null): Array<{ name: string; relationship: string }> {
  if (!text || !text.trim()) return [];
  const parts = text.split(/[;,\n\r]+/).map(p => p.trim()).filter(Boolean);
  return parts.map(part => {
    const match = part.match(/^([^:-]+)[:\-]\s*(.+)$/);
    if (match) {
      return { relationship: match[1].trim(), name: match[2].trim() };
    }
    return { relationship: "Family Member", name: part };
  });
}

// A household link supplements the member's application; it never replaces it.
export function memberFamily(household?: Household | null, applicationDetails?: string | null) {
  const family = householdFamily(household);
  const entries = [...family.entries];
  const names = new Set(entries.flatMap(entry => [entry.name, ...entry.aliases].map(normalizeName)));
  for (const entry of parseFamilyDetailsText(applicationDetails)) {
    const name = normalizeName(entry.name);
    if (names.has(name)) continue;
    names.add(name);
    entries.push({ ...entry, role: null, member: undefined, aliases: [] });
  }
  return {
    ...family,
    entries,
    summary: entries.map(entry => entry.relationship === "Family Member" ? entry.name : `${entry.relationship}: ${entry.name}`).join("; ")
  };
}

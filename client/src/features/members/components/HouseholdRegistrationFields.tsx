import React, { useState } from "react";
import { Search, X, Users } from "lucide-react";
import { Household, HouseholdFamilyMember, Member } from "../../../types";
import { familyRelationships, householdFamily, memberName, normalizeName, HouseholdRole, householdRoles, householdRoleLabels, parentRoles } from "../householdFamily";
import { Button } from "../../../components/common/Button";

interface Props {
  members: Member[];
  households: Household[];
  household?: Household;
  name: string;
  householdName: string;
  isEditing: boolean;
  role: HouseholdRole | "";
  onRoleChange: (role: HouseholdRole | "") => void;
  requireRelationship?: boolean;
  allowFamilyLinking?: boolean;
  family: HouseholdFamilyMember[];
  onFamilyChange: (family: HouseholdFamilyMember[]) => void;
  onJoinHousehold: (id: number) => void;
  spouseName?: string;
  replacingRelativeName?: string;
}

export function HouseholdRegistrationFields({ members, households, household, name, householdName, isEditing, role, onRoleChange, requireRelationship = false, allowFamilyLinking = true, family, onFamilyChange, onJoinHousehold, spouseName, replacingRelativeName }: Props) {
  const [query, setQuery] = useState("");
  const results = query.trim() ? members.filter(member =>
    normalizeName(memberName(member)).includes(normalizeName(query)) && !family.some(entry => entry.member_id === member.id)
  ).slice(0, 8) : [];
  const existing = householdFamily(household).entries;
  const preview = existing.filter(entry => normalizeName(entry.name) !== normalizeName(name) &&
    (!replacingRelativeName || normalizeName(entry.name) !== normalizeName(replacingRelativeName)) &&
    !family.some(selected => normalizeName(selected.name) === normalizeName(entry.name)));

  return (
    <div className="space-y-3 border-t border-indigo-100 pt-3" data-guide="member-family-links">
      <label className="ui-field">
        Your relationship in this household{requireRelationship || family.length > 0 ? " *" : ""}
        <select
          aria-label="Your relationship in this household"
          value={role}
          onChange={event => onRoleChange(event.target.value as HouseholdRole | "")}
          required={requireRelationship || family.length > 0}
          className="ui-input mt-1"
        >
          <option value="">-- Choose your relationship --</option>
          {householdRoles.map(role => <option key={role} value={role}>{householdRoleLabels[role]}</option>)}
        </select>
        <span className="ui-help block mt-1">Choose how you belong to this family, such as Son, Daughter, Grandfather (Lolo), or Grandmother (Lola).</span>
      </label>
      {allowFamilyLinking && <div>
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-indigo-950"><Users className="w-3.5 h-3.5" /> Link Existing Family Members</h4>
        <p className="text-[12px] text-muted mt-1">Search for a relative already registered in DPC. Each relationship describes their place in this household.</p>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted" />
          <input aria-label="Search existing family members" placeholder="Search existing child or relative..." value={query}
            onChange={event => setQuery(event.target.value)}
            className="ui-input pl-9" />
        </div>
        {query.trim() && (
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {results.length === 0 && <p className="text-[12px] text-muted p-2">No matching registered members.</p>}
            {results.map(member => {
              const target = households.find(candidate => candidate.id === member.household_id);
              const joining = !!member.household_id && member.household_id !== household?.id;
              const conflicting = joining && (!!household || family.some(entry => {
                const selected = members.find(candidate => candidate.id === entry.member_id);
                return selected?.household_id && selected.household_id !== member.household_id;
              }));
              return (
                <button key={member.id} type="button"
                  disabled={!!conflicting || (joining && !target)}
                  aria-label={`${joining ? "Join household with" : "Link"} ${memberName(member)}`}
                  className="w-full p-2.5 rounded-xl border border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 text-left disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  onClick={() => {
                    if (joining) {
                      onJoinHousehold(member.household_id!);
                    } else {
                      onFamilyChange([...family, { member_id: member.id, name: memberName(member), relationship: parentRoles.includes(role as any) ? (member.gender === "Female" ? "Daughter" : "Son") : "Family Member" }]);
                    }
                    setQuery("");
                  }}
                >
                  <span className="block font-medium text-indigo-950">{memberName(member)}</span>
                  <span className="block text-[12px] text-muted">{member.ministry_name || "Church Member"}{member.age != null ? ` · ${member.age} yrs` : ""}</span>
                  <span className="block text-[12px] text-indigo-700 mt-1">{conflicting ? `Already belongs to ${target?.name || "another household"}` : joining ? `Join ${target?.name || "existing household"}` : `Link to ${household?.name || "this new household"}`}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>}
      {allowFamilyLinking && family.map(entry => (
        <div key={entry.member_id} className="flex flex-wrap items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="flex-1 text-xs font-medium text-indigo-950">{entry.name}<span className="block text-[12px] text-emerald-700">Existing member</span></span>
          <select aria-label={`Relationship for ${entry.name}`} value={entry.relationship}
            onChange={event => onFamilyChange(family.map(item => item.member_id === entry.member_id ? { ...item, relationship: event.target.value } : item))}
            className="bg-white border border-indigo-200 rounded-lg px-2 py-1.5 text-xs">
            {familyRelationships.map(relationship => <option key={relationship}>{relationship}</option>)}
          </select>
          <Button variant="ghost" size="icon" aria-label={`Remove ${entry.name} from selection`} onClick={() => onFamilyChange(family.filter(item => item.member_id !== entry.member_id))}>
            <X aria-hidden="true" className="w-4 h-4" />
          </Button>
        </div>
      ))}
      {(role || family.length > 0) && (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-xs space-y-1" aria-label="Household preview">
          <h4 className="font-semibold text-indigo-950">{household?.name || householdName || "New household"} · Preview</h4>
          <p>{name || "This member"} — {role ? householdRoleLabels[role] : "Family Member"} · {isEditing ? "Existing member" : "New member"}</p>
          {spouseName && normalizeName(spouseName) !== normalizeName(name) && !preview.some(entry => normalizeName(entry.name) === normalizeName(spouseName)) && <p>{spouseName} — Spouse</p>}
          {preview.map(entry => <p key={entry.name}>{entry.name} — {entry.relationship}</p>)}
          {family.map(entry => <p key={entry.member_id}>{entry.name} — {entry.relationship} · Existing member</p>)}
          <p className="text-[12px] text-muted pt-1">{allowFamilyLinking ? "Selected members keep their existing profiles and attendance records. " : ""}Changes apply when you save.</p>
        </div>
      )}
    </div>
  );
}

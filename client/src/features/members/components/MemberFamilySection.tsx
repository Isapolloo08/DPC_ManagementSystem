import React from "react";
import { ArrowRight, House, Phone, Users } from "lucide-react";
import type { Household, Member } from "../../../types";
import { Button } from "../../../components/common/Button";
import { memberFamily } from "../householdFamily";
import type { RelativeRegistrationContext } from "../types";

interface Props {
  member: Member;
  household?: Household;
  canEdit: boolean;
  onViewMember: (member: Member) => void;
  onRegister: (context: RelativeRegistrationContext) => void;
}

export function MemberFamilySection({ member, household, canEdit, onViewMember, onRegister }: Props) {
  const entries = memberFamily(household, member.family_details).entries;
  return <section aria-label="Family members" className="sm:col-span-2 p-4 rounded-2xl border border-indigo-100 bg-ivory-light/70 space-y-3">
    <div className="flex items-start justify-between flex-wrap gap-2 pb-2 border-b border-indigo-100">
      <h3 className="flex items-center gap-2 font-semibold text-xs text-indigo-950">
        <Users aria-hidden="true" className="w-4 h-4" /> Family Members ({entries.length})
      </h3>
      {household && <span className="flex items-start gap-1.5 text-xs text-muted max-w-full">
        <House aria-hidden="true" className="w-4 h-4 shrink-0" /><span className="break-words min-w-0">{household.name}</span>
      </span>}
    </div>
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map(entry => {
        const registered = entry.member;
        const viewing = registered?.id === member.id;
        const relationship = entry.relationship.toLowerCase();
        const relationshipClass = relationship === "father" || relationship === "mother" ? "bg-amber-100 text-amber-900"
          : relationship.includes("guardian") ? "bg-purple-100 text-purple-900" : "bg-indigo-100 text-indigo-900";
        return <li key={registered ? `member-${registered.id}` : `relative-${entry.name}`}
          className={`p-3 rounded-xl border space-y-2 ${viewing ? "bg-indigo-50 border-indigo-200" : "bg-white border-indigo-100"}`}>
          <div className="flex items-start flex-wrap gap-2">
            <span className={`text-xs rounded-md px-2 py-0.5 ${relationshipClass}`}>{entry.relationship}</span>
            <span className="flex-1 min-w-[8rem] font-medium text-xs text-indigo-950 break-words">{entry.name}</span>
            {viewing && <span className="text-xs text-indigo-700 font-medium">Viewing</span>}
          </div>
          {registered?.contact_phone && <p className="flex items-center gap-1.5 text-xs text-muted">
            <Phone aria-hidden="true" className="w-3.5 h-3.5" /><span>{registered.contact_phone}</span>
          </p>}
          <div className="flex items-center justify-between flex-wrap gap-2">
            {registered ? <span className="text-xs text-emerald-700">
              {registered.ministry_name || "DPC Member"}{registered.age != null ? ` • ${registered.age}y` : ""}
            </span> : <span className="text-xs text-muted">Relative</span>}
            {registered && !viewing && <Button variant="ghost" size="icon" title={`View ${registered.first_name}'s Profile`}
              aria-label={`View ${entry.name}'s Profile`} onClick={() => onViewMember(registered)}>
              <ArrowRight aria-hidden="true" className="w-4 h-4" />
            </Button>}
            {!registered && canEdit && <Button size="sm" disabled={!household} aria-label={`Register ${entry.name} as member`}
              title={household ? `Register ${entry.name} in this household` : "Assign this family to a household first"}
              onClick={() => household && onRegister({ name: entry.name, relationship: entry.relationship, household, sourceMember: member })}>
              Register Member
            </Button>}
          </div>
        </li>;
      })}
    </ul>
    {!household && canEdit && entries.some(entry => !entry.member) &&
      <p className="ui-help">Assign this family to a household before registering relatives.</p>}
  </section>;
}

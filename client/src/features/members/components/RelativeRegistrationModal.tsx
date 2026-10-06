import React, { useId, useState } from "react";
import { Search } from "lucide-react";
import type { Household, Member } from "../../../types";
import { Button } from "../../../components/common/Button";
import { Dialog } from "../../../components/common/Dialog";
import { memberName, relationshipRole, householdRoles, householdRoleLabels } from "../householdFamily";
import type { RelativeRegistrationContext } from "../types";
import { useRelativeMemberSearch } from "../hooks/useRelativeMemberSearch";
import { registrationError } from "../services/memberRegistrationService";

interface Props {
  context: RelativeRegistrationContext;
  households: Household[];
  onClose: () => void;
  onCreate: (relationship: string) => void;
  onLink: (member: Member, relationship: string) => Promise<void>;
}

export function RelativeRegistrationModal({ context, households, onClose, onCreate, onLink }: Props) {
  const [query, setQuery] = useState(context.name);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [linkError, setLinkError] = useState("");
  const [role, setRole] = useState(relationshipRole(context.relationship));
  const { state, retry } = useRelativeMemberSearch(query.trim() || context.name, context.sourceMember.id);
  const searchId = useId();
  const roleId = useId();
  const busy = linkingId !== null;
  const candidates = state.status === "success" ? state.result.members : [];

  return <Dialog title={`Register ${context.name}`} accessibleName="Register family relative"
    description={`${context.household.name} · ${context.relationship}`}
    closeLabel="Close relative registration" onClose={onClose} busy={busy}
    footer={<>
      <Button disabled={busy} onClick={onClose}>Cancel</Button>
      <Button variant="primary" disabled={state.status !== "success" || busy}
        onClick={() => onCreate(householdRoleLabels[role])}>Register as New Member</Button>
    </>}>
    <div className="space-y-4">
      <p className="ui-help">Check the full name and birthday. If this person already has a member record, link that record to this family.</p>
      <div>
        <label htmlFor={roleId} className="ui-field mb-1">Relationship in this household</label>
        <select id={roleId} aria-label="Relative relationship in household" value={role} disabled={busy}
          onChange={event => setRole(event.target.value as typeof role)} className="ui-input">
          {householdRoles.map(role => <option key={role} value={role}>{householdRoleLabels[role]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={searchId} className="ui-field mb-1">Search existing members</label>
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-3 top-3.5 w-4 h-4 text-muted" />
          <input id={searchId} data-dialog-autofocus aria-label="Search existing members for relative"
            aria-controls={`${searchId}-results`} autoComplete="off" value={query} disabled={busy}
            onChange={event => { setQuery(event.target.value); setLinkError(""); }} className="ui-input pl-10" />
        </div>
      </div>
      <div id={`${searchId}-results`} aria-busy={state.status === "loading"}>
        {state.status === "loading" && <p role="status" className="ui-help">Checking existing member records…</p>}
        {state.status === "error" && <div className="ui-error space-y-2">
          <p role="alert">{state.error}</p>
          <Button size="sm" onClick={retry}>Retry search</Button>
        </div>}
        {state.status === "success" && candidates.length === 0 &&
          <p role="status" className="ui-help">No existing member records found. Complete the new member's details below.</p>}
        {candidates.length > 0 && <>
          <h3 className="ui-field mb-2">Matching member records ({candidates.length})</h3>
          <ul className="ui-candidate-list">
            {candidates.map(member => {
              const otherHousehold = !!member.household_id && member.household_id !== context.household.id;
              const household = households.find(h => h.id === member.household_id);
              return <li key={member.id} className="ui-candidate">
                <p className="ui-candidate-name">{memberName(member)}</p>
                <p className="ui-help">Birthday: {member.birthdate?.split("T")[0] || "Not recorded"} · {member.ministry_name || "DPC Member"}</p>
                <p className="ui-help">{household?.name || (member.household_id ? "Assigned to another household" : "No household linked")}</p>
                {otherHousehold && <p className="ui-help text-amber-800">Update this person's household in their member record before linking them here.</p>}
                <div><Button size="sm" disabled={otherHousehold || busy} pending={linkingId === member.id}
                  aria-label={`Link existing member ${memberName(member)}`} onClick={async () => {
                    setLinkingId(member.id); setLinkError("");
                    try { await onLink(member, householdRoleLabels[role]); }
                    catch (error) { setLinkError(registrationError(error, "Could not link this member. Please try again.")); }
                    finally { setLinkingId(null); }
                  }}>Link Existing Record</Button></div>
              </li>;
            })}
          </ul>
        </>}
        {state.status === "success" && state.result.hasMore &&
          <p className="ui-help mt-2">Enter a more complete name to narrow the results.</p>}
      </div>
      {linkError && <p role="alert" className="ui-error">{linkError}</p>}
    </div>
  </Dialog>;
}

import React, { useId } from "react";
import { Household } from "../../../types";
import { householdFamily, memberFamily } from "../householdFamily";

interface Props {
  household?: Household;
  details: string;
  onDetailsChange: (details: string) => void;
  label?: string;
  placeholder?: string;
}

export function MemberFamilyDetailsField({ household, details, onDetailsChange,
  label = "Family Members (Parents & siblings)", placeholder = "e.g. Parents, 2 siblings" }: Props) {
  const id = useId();
  const hasHouseholdFamily = householdFamily(household).entries.length > 0;
  const summary = hasHouseholdFamily ? memberFamily(household, details).summary : details;

  return (
    <div data-guide="member-family" className="space-y-2">
      <div>
        <label htmlFor={id} className="ui-field mb-1">{label}</label>
        <textarea id={id} rows={hasHouseholdFamily ? 3 : 2} placeholder={placeholder}
          value={summary} readOnly={hasHouseholdFamily}
          onChange={event => onDetailsChange(event.target.value)}
          className="ui-input resize-y" />
      </div>
      {hasHouseholdFamily && (
        <>
          <p className="ui-help">Family members from {household?.name}. Edit the household to update these names or relationships.</p>
          <div>
            <label htmlFor={`${id}-additional`} className="ui-field mb-1">Additional family details</label>
            <textarea id={`${id}-additional`} rows={2} placeholder="e.g. Other relatives or living arrangements"
              value={details} onChange={event => onDetailsChange(event.target.value)}
              className="ui-input resize-y" />
          </div>
        </>
      )}
    </div>
  );
}

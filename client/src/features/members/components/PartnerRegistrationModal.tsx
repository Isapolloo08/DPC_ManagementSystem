import React, { useEffect, useRef } from "react";
import { ArrowLeft, Check, Heart, Users } from "lucide-react";
import { DatePickerInput } from "../../../components/common/DatePickerInput";
import { AddressPicker } from "../../../components/common/AddressPicker";
import { SearchableAutocomplete, AutocompleteSuggestion } from "../../../components/common/SearchableAutocomplete";
import { Household } from "../../../types";
import { MemberFamilyDetailsField } from "./MemberFamilyDetailsField";
import { Button } from "../../../components/common/Button";

export interface PartnerRegistrationData {
  first_name: string;
  last_name: string;
  birthdate: string;
  gender: string;
  application_date: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  same_address_as_member: boolean;
  same_inviter_as_member: boolean;
  occupation: string;
  facebook_account: string;
  family_details: string;
  hobbies: string;
  invited_by: string;
  previous_church: string;
  medical_notes: string;
}

interface Props {
  spouseFormData: PartnerRegistrationData;
  setSpouseFormData: React.Dispatch<React.SetStateAction<PartnerRegistrationData>>;
  formData: { address: string; invited_by: string; family_details: string };
  household?: Household;
  memberName: string;
  memberSuggestions: AutocompleteSuggestion[];
  onBack: () => void;
  onSubmit: (event: React.FormEvent) => void;
  isSaving: boolean;
}

const sanitizePhoneInput = (value: string) => value.replace(/\D/g, "").slice(0, 11);

export const PartnerRegistrationModal: React.FC<Props> = ({
  spouseFormData, setSpouseFormData, formData, household, memberName, memberSuggestions, onBack, onSubmit, isSaving
}) => {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => { panelRef.current?.focus(); }, []);

  return (
    <section data-modal-panel ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="partner-registration-title"
      className="bg-white rounded-3xl w-full xl:w-[min(46vw,640px)] shrink-0 shadow-2xl border border-indigo-100 flex flex-col max-h-[92vh] overflow-hidden outline-none">
      <header data-modal-header className="p-5 sm:p-6 border-b border-indigo-100">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] uppercase tracking-widest font-medium text-indigo-600">Step 2 of 2 · Partner</span>
          <button type="button" onClick={onBack} disabled={isSaving} className="flex items-center gap-1 text-xs font-medium text-indigo-600 disabled:opacity-50">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Member
          </button>
        </div>
        <h2 id="partner-registration-title" className="mt-2 font-semibold text-base text-charcoal flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" /> Register Partner as New Member
        </h2>
        <p className="mt-1 text-xs text-charcoal/70">Partner of {memberName}. Review shared details, then save both records together.</p>
      </header>
      <form onSubmit={onSubmit} className="flex flex-col min-h-0">
        <div inert={isSaving} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-charcoal/70 mb-1 text-[12px]">
                Partner First Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Maria"
                value={spouseFormData.first_name}
                onChange={(e) => setSpouseFormData({ ...spouseFormData, first_name: e.target.value })}
                className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
              />
            </div>
            <div>
              <label className="block font-medium text-charcoal/70 mb-1 text-[12px]">
                Partner Last Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Almadrones"
                value={spouseFormData.last_name}
                onChange={(e) => setSpouseFormData({ ...spouseFormData, last_name: e.target.value })}
                className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <DatePickerInput
                label="Partner Birthday"
                required
                value={spouseFormData.birthdate}
                onChange={(val) => setSpouseFormData({ ...spouseFormData, birthdate: val })}
                placeholder="Select birthday"
              />
            </div>
            <div>
              <label className="block font-medium text-charcoal/70 mb-1 text-[12px]">
                Partner Gender *
              </label>
              <select
                value={spouseFormData.gender}
                onChange={(e) => setSpouseFormData({ ...spouseFormData, gender: e.target.value })}
                className="w-full bg-white p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo h-[41px] text-xs font-medium"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
            <div>
              <DatePickerInput
                label="Date of Application"
                value={spouseFormData.application_date}
                onChange={(val) => setSpouseFormData({ ...spouseFormData, application_date: val })}
                placeholder="Select application date"
              />
            </div>
          </div>

          {/* Contact & Socials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-medium text-charcoal/70 text-[12px]">
                  Partner Contact Phone
                </label>
                {spouseFormData.contact_phone && (
                  <span className={`text-[12px] font-medium ${spouseFormData.contact_phone.length === 11 ? "text-emerald-600" : "text-muted"}`}>
                    {spouseFormData.contact_phone.length}/11
                  </span>
                )}
              </div>
              <input
                type="tel"
                maxLength={11}
                placeholder="e.g. 09123456789"
                value={spouseFormData.contact_phone}
                onChange={(e) => setSpouseFormData({ ...spouseFormData, contact_phone: sanitizePhoneInput(e.target.value) })}
                className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs font-medium"
              />
            </div>
            <div>
              <label className="block font-medium text-charcoal/70 mb-1 text-[12px]">
                Partner Contact Email
              </label>
              <input
                type="email"
                placeholder="e.g. partner@email.com"
                value={spouseFormData.contact_email}
                onChange={(e) => setSpouseFormData({ ...spouseFormData, contact_email: e.target.value })}
                className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
              />
            </div>
            <div>
              <label className="block font-medium text-charcoal/70 mb-1 text-[12px]">
                Partner Facebook Account
              </label>
              <input
                type="text"
                placeholder="e.g. Fb: Maria Clara"
                value={spouseFormData.facebook_account}
                onChange={(e) => setSpouseFormData({ ...spouseFormData, facebook_account: e.target.value })}
                className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
              />
            </div>
          </div>

          {/* Junior Adult Card Fields: Occupation, Hobbies, Family Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-medium text-charcoal/70 mb-1 text-[12px]">
                Partner Occupation
              </label>
              <input
                type="text"
                placeholder="e.g. Teacher, Office staff, Nurse, Business"
                value={spouseFormData.occupation}
                onChange={(e) => setSpouseFormData({ ...spouseFormData, occupation: e.target.value })}
                className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
              />
            </div>
            <div>
              <label className="block font-medium text-charcoal/70 mb-1 text-[12px]">
                Partner Hobbies
              </label>
              <input
                type="text"
                placeholder="e.g. Cooking, reading, music, gardening"
                value={spouseFormData.hobbies}
                onChange={(e) => setSpouseFormData({ ...spouseFormData, hobbies: e.target.value })}
                className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
              />
            </div>
          </div>

          <MemberFamilyDetailsField household={household} label="Partner Family Members / Children"
            placeholder="e.g. Children: Juan Jr., Mateo, Sophia"
            details={spouseFormData.family_details || formData.family_details}
            onDetailsChange={details => setSpouseFormData(prev => ({ ...prev, family_details: details }))} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <fieldset className="space-y-2">
                <legend className="font-medium text-charcoal/70 mb-1">Same person who invited the main member?</legend>
                <div className="flex flex-wrap gap-3">
                  {[true, false].map(same => (
                    <label key={String(same)} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="partner-same-inviter" checked={spouseFormData.same_inviter_as_member === same}
                        onChange={() => setSpouseFormData(prev => ({ ...prev, same_inviter_as_member: same }))} />
                      {same ? "Yes, same inviter" : "No, different inviter"}
                    </label>
                  ))}
                </div>
                {spouseFormData.same_inviter_as_member ? (
                  <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <span className="block font-medium text-indigo-950">Who Invites You in DPC?</span>
                    <p className="mt-1 text-charcoal">{formData.invited_by || "No inviter entered for the main member."}</p>
                  </div>
                ) : (
                  <SearchableAutocomplete label="Who Invites Partner in DPC?" value={spouseFormData.invited_by}
                    onChange={val => setSpouseFormData(prev => ({ ...prev, invited_by: val }))}
                    placeholder="Search member name or type custom..." suggestions={memberSuggestions}
                    icon={<Users className="w-3.5 h-3.5 text-indigo-600" />} />
                )}
              </fieldset>
            </div>
            <div>
              <label className="block font-medium text-charcoal/70 mb-1 text-[12px]">
                Previous Religion / Church Attended
              </label>
              <input
                type="text"
                placeholder="e.g. Roman Catholic / Baptist / None"
                value={spouseFormData.previous_church}
                onChange={(e) => setSpouseFormData({ ...spouseFormData, previous_church: e.target.value })}
                className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-charcoal/70 mb-1 text-[12px]">
              Partner Medical / Allergy Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Asthma, Seafood allergy, None"
              value={spouseFormData.medical_notes}
              onChange={(e) => setSpouseFormData({ ...spouseFormData, medical_notes: e.target.value })}
              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
            />
          </div>

          <fieldset className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2">
            <legend className="font-medium text-indigo-950 px-1">Do you live together at the same address? / Magkasama ba kayo sa tirahan?</legend>
            <div className="flex flex-wrap gap-3">
              {[true, false].map(same => (
                <label key={String(same)} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="partner-same-address" checked={spouseFormData.same_address_as_member === same}
                    onChange={() => setSpouseFormData(prev => ({ ...prev, same_address_as_member: same }))} />
                  {same ? "Yes, same address" : "No, different address"}
                </label>
              ))}
            </div>
            {spouseFormData.same_address_as_member ? (
              <div className="p-2.5 bg-white rounded-xl border border-indigo-100">
                <span className="font-medium text-indigo-950">Partner Present Address</span>
                <p className="mt-1 text-charcoal">{formData.address || "No address entered for the main member."}</p>
              </div>
            ) : (
              <AddressPicker label="Partner Present Address" required value={spouseFormData.address}
                initialManualMode={Boolean(spouseFormData.address)}
                onChange={address => setSpouseFormData(prev => ({ ...prev, address }))} />
            )}
          </fieldset>
          <p className="text-[12px] text-charcoal/70">Both records will be linked as spouses and use the selected family household.</p>
        </div>
        <footer className="p-4 sm:px-6 border-t border-indigo-100 flex items-center justify-between gap-2">
          <Button onClick={onBack} disabled={isSaving}>Back to Member</Button>
          <Button type="submit" variant="primary" pending={isSaving}>
            {!isSaving && <Check aria-hidden="true" className="w-4 h-4" />} {isSaving ? "Saving..." : "Save Both Members"}
          </Button>
        </footer>
      </form>
    </section>
  );
};

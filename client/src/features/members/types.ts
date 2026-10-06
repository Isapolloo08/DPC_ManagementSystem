import type { Household, Member } from "../../types";

export interface RelativeRegistrationContext {
  name: string;
  relationship: string;
  household: Household;
  sourceMember: Member;
}

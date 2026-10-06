import { api } from "../../../api";
import type { Member } from "../../../types";
import type { RelativeRegistrationContext } from "../types";
import { relationshipRole } from "../householdFamily";

export interface MemberSearchResult { members: Member[]; hasMore: boolean }

export const memberRegistrationService = {
  async search(query: string, excludeId: number): Promise<MemberSearchResult> {
    const response: Member[] | { data: Member[]; pagination?: { total: number } } =
      await api.getMembers({ search: query, page: 1, limit: 21 });
    const records = Array.isArray(response) ? response : response.data;
    if (!Array.isArray(records)) throw new Error("Could not read existing member records. Please retry.");
    const candidates = records.filter(member => member.id !== excludeId);
    return { members: candidates.slice(0, 20), hasMore: candidates.length > 20 || (!Array.isArray(response) && (response.pagination?.total || 0) > 21) };
  },
  async checkDuplicate(name: string, excludeId?: number): Promise<Member | null> {
    const response = await api.checkMemberDuplicate({ name, exclude_id: excludeId });
    return response.duplicateName || null;
  },
  linkRelative(context: RelativeRegistrationContext, member: Member, relationship: string) {
    const payload = {
      ...(member.address ? {} : { address: context.household.address || context.sourceMember.address || "" }),
      household_registration: { mode: "existing" as const, household_id: context.household.id,
        role: relationshipRole(relationship), family_members: [],
        relative: { name: context.name, source_member_id: context.sourceMember.id } }
    };
    return api.updateMember(member.id, payload);
  }
};

export function registrationError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

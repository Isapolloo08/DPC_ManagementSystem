import React, { useState } from "react";
import { BibleStudyGroup, BibleStudyMember } from "../../types";
import { Search, UserPlus, Phone, Users, Plus, Layers } from "lucide-react";

interface LeaderMembersProps {
  activeGroup: BibleStudyGroup | null;
  groupDisciples: BibleStudyMember[];
  ledGroups?: BibleStudyGroup[];
  selectedGroupId?: number | null;
  onSelectGroup?: (groupId: number) => void;
  onOpenAddDiscipleModal: () => void;
  onOpenCreateGroupModal?: () => void;
}

export const LeaderMembers: React.FC<LeaderMembersProps> = ({
  activeGroup,
  groupDisciples,
  ledGroups = [],
  selectedGroupId,
  onSelectGroup,
  onOpenAddDiscipleModal,
  onOpenCreateGroupModal
}) => {
  const [memberSearch, setMemberSearch] = useState("");

  const filteredMembers = groupDisciples.filter(d => {
    const name = d.member_name || `${d.first_name || ""} ${d.last_name || ""}`;
    return (
      !memberSearch ||
      name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (d.contact_phone && d.contact_phone.includes(memberSearch))
    );
  });

  if (!activeGroup) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center space-y-4">
        <Users className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-base font-black text-slate-900">No Led Life Group Assigned Yet</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          You currently have no Life Group designated under your leadership. You can create a new small group fellowship or wait for a coordinator to assign one.
        </p>
        {onOpenCreateGroupModal && (
          <button
            onClick={onOpenCreateGroupModal}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>+ Create / Add Lead Group</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <span>Members in {activeGroup.name}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
                  {groupDisciples.length} Members
                </span>
              </h3>

              {ledGroups.length > 1 && onSelectGroup && (
                <div className="inline-flex items-center gap-1 ml-2">
                  <span className="text-[10px] font-bold text-slate-400">Switch Group:</span>
                  <select
                    value={selectedGroupId || activeGroup.id}
                    onChange={(e) => onSelectGroup(Number(e.target.value))}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    {ledGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">
              View contact details, attendance status, and spiritual milestones for each member under your leadership.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-600 bg-slate-50"
              />
            </div>

            {onOpenCreateGroupModal && (
              <button
                onClick={onOpenCreateGroupModal}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                title="Create another group you will lead"
              >
                <Plus className="w-3.5 h-3.5 text-slate-600" />
                <span>Add Lead Group</span>
              </button>
            )}

            <button
              onClick={onOpenAddDiscipleModal}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-300" />
              <span>Add Member</span>
            </button>
          </div>
        </div>

        {/* Members Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-charcoal/60 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Member Name</th>
                <th className="py-3 px-4">Ministry Bracket</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-charcoal/50">
                    <Users className="w-8 h-8 text-charcoal/30 mx-auto mb-2" />
                    <p className="font-bold text-xs">No members added to this group yet.</p>
                    <button
                      onClick={onOpenAddDiscipleModal}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-indigo text-white font-bold text-xs cursor-pointer"
                    >
                      + Add First Member
                    </button>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((d) => {
                  const displayName = d.member_name || `${d.first_name || ""} ${d.last_name || ""}`.trim() || "Member";
                  const initials = displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "M";

                  return (
                    <tr key={d.id} className="hover:bg-sky-50/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-900 border border-sky-200 flex items-center justify-center font-black text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-charcoal text-xs">{displayName}</div>
                            {d.contact_email && (
                              <p className="text-[10px] text-charcoal/50">{d.contact_email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo font-bold text-[10px]">
                          {activeGroup?.ministry_name || "Ministry"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {d.contact_phone ? (
                          <div className="flex items-center gap-1 text-charcoal">
                            <Phone className="w-3.5 h-3.5 text-charcoal/40" />
                            <span>{d.contact_phone}</span>
                          </div>
                        ) : (
                          <span className="text-charcoal/40 text-[11px] italic">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-charcoal/60 text-[11px]">
                        {d.joined_at ? new Date(d.joined_at).toLocaleDateString() : "Recent"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

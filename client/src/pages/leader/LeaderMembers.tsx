import React, { useState } from "react";
import { BibleStudyGroup, BibleStudyMember } from "../../types";
import { Search, UserPlus, Phone, HeartHandshake, Users } from "lucide-react";

interface LeaderMembersProps {
  activeGroup: BibleStudyGroup | null;
  groupDisciples: BibleStudyMember[];
  onOpenAddDiscipleModal: () => void;
  onOpenPrayerModal: (member: BibleStudyMember) => void;
}

export const LeaderMembers: React.FC<LeaderMembersProps> = ({
  activeGroup,
  groupDisciples,
  onOpenAddDiscipleModal,
  onOpenPrayerModal
}) => {
  const [memberSearch, setMemberSearch] = useState("");

  const filteredDisciples = groupDisciples.filter(d => {
    const name = d.member_name || `${d.first_name || ""} ${d.last_name || ""}`;
    return (
      !memberSearch ||
      name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (d.contact_phone && d.contact_phone.includes(memberSearch))
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-base text-charcoal flex items-center gap-2">
              <span>Disciples in {activeGroup?.name || "Life Group"}</span>
              <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
                {groupDisciples.length} Disciples
              </span>
            </h3>
            <p className="text-xs text-charcoal/50 mt-0.5">
              View contact details, family ties, and spiritual milestones for each disciple.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-charcoal/40 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search disciples..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-indigo"
              />
            </div>

            <button
              onClick={onOpenAddDiscipleModal}
              className="px-3.5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-300" />
              <span>Add Disciple</span>
            </button>
          </div>
        </div>

        {/* Disciples Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-charcoal/60 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Disciple Name</th>
                <th className="py-3 px-4">Ministry Bracket</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-right">Care & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDisciples.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-charcoal/50">
                    <Users className="w-8 h-8 text-charcoal/30 mx-auto mb-2" />
                    <p className="font-bold text-xs">No disciples added to this group yet.</p>
                    <button
                      onClick={onOpenAddDiscipleModal}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-indigo text-white font-bold text-xs"
                    >
                      + Add First Disciple
                    </button>
                  </td>
                </tr>
              ) : (
                filteredDisciples.map((d) => {
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

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onOpenPrayerModal(d)}
                          className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200 transition-all inline-flex items-center gap-1"
                        >
                          <HeartHandshake className="w-3.5 h-3.5 text-amber-700" />
                          <span>Log Prayer</span>
                        </button>
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

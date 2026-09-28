import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BibleStudyGroup, BibleStudyGroupHistoryResponse } from "../../types";
import { api } from "../../api";
import {
  History, GitMerge, ShieldCheck, Users, Calendar,
  ArrowRight, X, Clock, MapPin, BookOpen, AlertCircle,
  CheckCircle2, ChevronRight, UserCheck
} from "lucide-react";

interface GroupHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: BibleStudyGroup | null;
  onSelectRelatedGroup?: (groupId: number) => void;
}

export const GroupHistoryModal: React.FC<GroupHistoryModalProps> = ({
  isOpen,
  onClose,
  group,
  onSelectRelatedGroup
}) => {
  const [historyData, setHistoryData] = useState<BibleStudyGroupHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && group?.id) {
      loadHistory(group.id);
    }
  }, [isOpen, group?.id]);

  const loadHistory = async (groupId: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getGroupHistory(groupId);
      setHistoryData(res);
    } catch (err: any) {
      console.warn("Failed to load group history:", err);
      setError(err.message || "Failed to load transition history.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !group) return null;

  const isMergedSource = group.status === "merged";
  const createdTransition = historyData?.created_transition;
  const mergedInto = historyData?.merged_into_group;
  const sourceGroups = createdTransition?.source_groups || [];
  const leaders = historyData?.leaders || [];

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 space-y-4.5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-xs ${
              isMergedSource
                ? "bg-amber-100 text-amber-900"
                : "bg-indigo-100 text-indigo-900"
            }`}>
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-charcoal">Group Transition History</h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                  isMergedSource
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                }`}>
                  {isMergedSource ? "Merged Group" : "Active Group"}
                </span>
              </div>
              <p className="text-xs font-bold text-indigo-950/70">{group.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-charcoal/40 hover:text-charcoal hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-charcoal/50 space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p>Loading historical records...</p>
          </div>
        ) : error ? (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            
            {/* Case 1: Resulting Group created through Merge Transition */}
            {createdTransition && (
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-3">
                <div className="flex items-center gap-2 text-indigo-950 font-black">
                  <GitMerge className="w-4 h-4 text-indigo-700" />
                  <span>Created through Group Merge</span>
                </div>

                <div className="text-charcoal/80 space-y-1 bg-white p-3 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <span className="text-charcoal/60 font-medium">Effective Date:</span>
                    <strong className="text-charcoal">
                      {new Date(createdTransition.effective_date).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </strong>
                  </div>
                  {createdTransition.reason && (
                    <div className="flex items-center justify-between">
                      <span className="text-charcoal/60 font-medium">Transition Reason:</span>
                      <strong className="text-charcoal">{createdTransition.reason}</strong>
                    </div>
                  )}
                  {createdTransition.created_by_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-charcoal/60 font-medium">Authorized by:</span>
                      <span>{createdTransition.created_by_name}</span>
                    </div>
                  )}
                </div>

                {/* Source Groups List */}
                <div className="space-y-2">
                  <span className="text-[11px] font-black text-indigo-950 block">
                    Merged from {sourceGroups.length} Source Groups:
                  </span>
                  <div className="space-y-1.5">
                    {sourceGroups.map((sg) => (
                      <div
                        key={sg.id}
                        onClick={() => {
                          if (onSelectRelatedGroup) {
                            onSelectRelatedGroup(sg.id);
                          }
                        }}
                        className="p-2.5 bg-white rounded-xl border border-indigo-100 flex items-center justify-between hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group shadow-2xs"
                      >
                        <div>
                          <div className="font-extrabold text-charcoal group-hover:text-indigo flex items-center gap-1.5">
                            <span>• {sg.name}</span>
                            <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded font-bold">
                              Historical
                            </span>
                          </div>
                          <div className="text-[10px] text-charcoal/60 pl-3">
                            Leader: {sg.leader_name} {sg.member_count !== undefined ? `(${sg.member_count} members)` : ""}
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-charcoal/30 group-hover:text-indigo transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Case 2: Source Group that was merged into another group */}
            {isMergedSource && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-950 font-black">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Status: Merged</span>
                  </div>
                  {group.effective_date && (
                    <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
                      Active until: {group.effective_date}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-amber-900 leading-relaxed">
                  This Bible study group was consolidated into a merged group. All historical sessions and attendance records remain strictly archived under this group.
                </p>

                {mergedInto && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-950">Merged into:</span>
                    <div
                      onClick={() => {
                        if (mergedInto.id && onSelectRelatedGroup) {
                          onSelectRelatedGroup(mergedInto.id);
                        }
                      }}
                      className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <div>
                        <div className="font-extrabold text-charcoal group-hover:text-indigo text-xs">
                          {mergedInto.name}
                        </div>
                        <div className="text-[10px] text-charcoal/60">
                          Primary Leader: {mergedInto.leader_name}
                          {mergedInto.assistant_leader_name ? ` • Asst: ${mergedInto.assistant_leader_name}` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-700">
                        <span>View Group</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Leadership Roster & History */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <span className="font-black text-xs text-charcoal uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-indigo" />
                  <span>Leadership Record</span>
                </span>
                <span className="text-[10px] text-charcoal/50 font-medium">Assigned Leaders</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-gray-200 text-xs">
                  <div>
                    <div className="font-bold text-charcoal">{group.leader_name}</div>
                    <div className="text-[10px] text-charcoal/50">{group.leader_contact || "Primary Facilitator"}</div>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900">
                    Primary Leader
                  </span>
                </div>

                {group.assistant_leader_name && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-gray-200 text-xs">
                    <div>
                      <div className="font-bold text-charcoal">{group.assistant_leader_name}</div>
                      <div className="text-[10px] text-charcoal/50">{group.assistant_leader_contact || "Assistant Facilitator"}</div>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      Assistant Leader
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Historical Notice */}
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[11px] text-charcoal/70 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                All past session roll-calls, discipleship notes, and progress logs are permanently referenced to the group that held them at that time.
              </span>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-xs text-charcoal cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

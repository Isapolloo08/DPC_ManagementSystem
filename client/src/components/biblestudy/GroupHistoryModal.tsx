import { ModalPanel } from "../common/ModalPanel";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BibleStudyGroup, BibleStudyGroupHistoryResponse, BibleStudyGroupTransition } from "../../types";
import { api } from "../../api";
import {
  History, GitMerge, ShieldCheck, Users, Calendar,
  ArrowRight, X, Clock, MapPin, BookOpen, AlertCircle,
  CheckCircle2, ChevronRight, UserCheck, Search, Layers,
  FileText, Sparkles, Filter
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
  const [activeTab, setActiveTab] = useState<"group" | "all">("group");
  const [historyData, setHistoryData] = useState<BibleStudyGroupHistoryResponse | null>(null);
  const [allTransitions, setAllTransitions] = useState<BibleStudyGroupTransition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (isOpen) {
      if (group?.id) {
        setActiveTab("group");
        loadGroupHistory(group.id);
      } else {
        setActiveTab("all");
        loadAllTransitions();
      }
    }
  }, [isOpen, group?.id]);

  useEffect(() => {
    if (isOpen && activeTab === "all" && allTransitions.length === 0) {
      loadAllTransitions();
    }
  }, [isOpen, activeTab]);

  const loadGroupHistory = async (groupId: number) => {
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

  const loadAllTransitions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getGroupTransitions();
      setAllTransitions(res || []);
    } catch (err: any) {
      console.warn("Failed to load all transitions:", err);
      setError(err.message || "Failed to load transition log.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isMergedSource = group?.status === "merged";
  const createdTransition = historyData?.created_transition;
  const mergedInto = historyData?.merged_into_group;
  const sourceGroups = createdTransition?.source_groups || [];

  const filteredTransitions = allTransitions.filter(t => {
    if (filterType !== "all" && t.transition_type !== filterType) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchesTarget = (t.new_group_name || "").toLowerCase().includes(q);
    const matchesReason = (t.reason || "").toLowerCase().includes(q);
    const matchesCreator = (t.created_by_name || "").toLowerCase().includes(q);
    const matchesSources = (t.source_groups || []).some(sg =>
      sg.name.toLowerCase().includes(q) || (sg.leader_name || "").toLowerCase().includes(q)
    );
    return matchesTarget || matchesReason || matchesCreator || matchesSources;
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-indigo-100 space-y-4.5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div data-modal-header className="flex items-start justify-between border-b border-gray-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-medium shadow-xs ${
              activeTab === "all"
                ? "bg-purple-100 text-purple-900"
                : isMergedSource
                ? "bg-amber-100 text-amber-900"
                : "bg-indigo-100 text-indigo-900"
            }`}>
              {activeTab === "all" ? <GitMerge className="w-5 h-5" /> : <History className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-charcoal">
                  {activeTab === "all" ? "All Church Transitions & Merges Log" : "Group Transition History"}
                </h3>
                {group && activeTab === "group" && (
                  <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full uppercase ${
                    isMergedSource
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  }`}>
                    {isMergedSource ? "Merged Group" : "Active Group"}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-indigo-950/70">
                {activeTab === "all"
                  ? "Overall central record of group merges, consolidations, and restructuring"
                  : (group?.name || "Group History")}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-charcoal hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>



        {loading ? (
          <div className="py-12 text-center text-xs text-muted space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p>Loading historical records...</p>
          </div>
        ) : error ? (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        ) : activeTab === "all" ? (
          /* TAB 2: OVERALL / ALL-CHURCH TRANSITIONS LOG */
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search by group name, leader, reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-charcoal"
              >
                <option value="all">All Types</option>
                <option value="MERGE">Group Merges</option>
                <option value="SPLIT">Group Splits</option>
                <option value="MOVE_MEMBERS">Member Moves</option>
              </select>
            </div>

            {/* List of transitions */}
            {filteredTransitions.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-gray-50 rounded-2xl border border-gray-100">
                <GitMerge className="w-8 h-8 text-charcoal/30 mx-auto" />
                <p className="text-xs font-medium text-muted">No transition or merge records found.</p>
                <p className="text-[12px] text-muted">Merged group transitions will appear here automatically.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransitions.map((t) => {
                  const sGroups = t.source_groups || [];
                  const isMerge = t.transition_type === "MERGE" || sGroups.length > 1;

                  return (
                    <div
                      key={t.id}
                      className="p-4 bg-gray-50/80 hover:bg-purple-50/40 rounded-2xl border border-gray-200 hover:border-purple-200 transition-all space-y-3 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-[12px] font-medium px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                            isMerge
                              ? "bg-purple-100 text-purple-900 border border-purple-300"
                              : "bg-blue-100 text-blue-900 border border-blue-300"
                          }`}>
                            <GitMerge className="w-3 h-3" />
                            <span>{isMerge ? "Group Merge" : t.transition_type}</span>
                          </span>
                          <span className="text-[12px] font-medium text-muted">
                            {new Date(t.effective_date || t.created_at).toLocaleDateString(undefined, {
                              year: "numeric", month: "short", day: "numeric"
                            })}
                          </span>
                        </div>

                        {t.created_by_name && (
                          <span className="text-[12px] text-muted bg-white px-2 py-0.5 rounded-lg border border-gray-200 font-medium">
                            Authorized by: <strong>{t.created_by_name}</strong>
                          </span>
                        )}
                      </div>

                      {/* Resulting Group & Source Groups Layout */}
                      <div className="bg-white p-3 rounded-xl border border-gray-200/90 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[12px] font-medium text-emerald-800 uppercase tracking-wider block">
                              Resulting Active Group
                            </span>
                            <strong className="text-xs text-charcoal font-medium">
                              {t.new_group_name || `Group #${t.new_group_id}`}
                            </strong>
                          </div>

                          {t.new_group_id && onSelectRelatedGroup && (
                            <button
                              onClick={() => {
                                onSelectRelatedGroup(t.new_group_id!);
                                onClose();
                              }}
                              className="text-[12px] font-medium px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <span>Inspect Group</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Source Groups */}
                        {sGroups.length > 0 && (
                          <div className="pt-2 border-t border-gray-100">
                            <span className="text-[12px] font-medium text-muted block mb-1">
                              Merged from {sGroups.length} source groups:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {sGroups.map((sg) => (
                                <div
                                  key={sg.id}
                                  className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-[12px] flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-medium text-charcoal">• {sg.name}</div>
                                    <div className="text-[12px] text-muted">Leader: {sg.leader_name}</div>
                                  </div>
                                  <span className="text-[12px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-medium uppercase">
                                    Merged Source
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Reason / Notes */}
                        {(t.reason || t.notes) && (
                          <div className="pt-2 border-t border-gray-100 text-[12px] text-charcoal/70 flex items-start gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                            <span>
                              {t.reason && <strong className="text-charcoal font-medium">{t.reason}: </strong>}
                              {t.notes}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* TAB 1: SINGLE GROUP HISTORY */
          <div className="space-y-4 text-xs">
            
            {/* Case 1: Resulting Group created through Merge Transition */}
            {createdTransition && (
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-3">
                <div className="flex items-center gap-2 text-indigo-950 font-medium">
                  <GitMerge className="w-4 h-4 text-indigo-700" />
                  <span>Created through Group Merge</span>
                </div>

                <div className="text-charcoal/80 space-y-1 bg-white p-3 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Effective Date:</span>
                    <strong className="text-charcoal">
                      {new Date(createdTransition.effective_date).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </strong>
                  </div>
                  {createdTransition.reason && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted font-medium">Transition Reason:</span>
                      <strong className="text-charcoal">{createdTransition.reason}</strong>
                    </div>
                  )}
                  {createdTransition.created_by_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted font-medium">Authorized by:</span>
                      <span>{createdTransition.created_by_name}</span>
                    </div>
                  )}
                </div>

                {/* Source Groups List */}
                <div className="space-y-2">
                  <span className="text-[12px] font-medium text-indigo-950 block">
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
                          <div className="font-medium text-charcoal group-hover:text-indigo flex items-center gap-1.5">
                            <span>• {sg.name}</span>
                            <span className="text-[12px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded font-medium">
                              Historical
                            </span>
                          </div>
                          <div className="text-[12px] text-muted pl-3">
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
                  <div className="flex items-center gap-2 text-amber-950 font-medium">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Status: Merged</span>
                  </div>
                  {group?.effective_date && (
                    <span className="text-[12px] font-medium text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
                      Active until: {group.effective_date}
                    </span>
                  )}
                </div>

                <p className="text-[12px] text-amber-900 leading-relaxed">
                  This Bible study group was consolidated into a merged group. All historical sessions and attendance records remain strictly archived under this group.
                </p>

                {mergedInto && (
                  <div className="space-y-1.5">
                    <span className="text-[12px] font-medium text-amber-950">Merged into:</span>
                    <div
                      onClick={() => {
                        if (mergedInto.id && onSelectRelatedGroup) {
                          onSelectRelatedGroup(mergedInto.id);
                        }
                      }}
                      className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <div>
                        <div className="font-medium text-charcoal group-hover:text-indigo text-xs">
                          {mergedInto.name}
                        </div>
                        <div className="text-[12px] text-muted">
                          Primary Leader: {mergedInto.leader_name}
                          {mergedInto.assistant_leader_name ? ` • Asst: ${mergedInto.assistant_leader_name}` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[12px] font-medium text-indigo-700">
                        <span>View Group</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Leadership Roster & History */}
            {group && (
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <span className="font-medium text-xs text-charcoal uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo" />
                    <span>Leadership Record</span>
                  </span>
                  <span className="text-[12px] text-muted font-medium">Assigned Leaders</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-gray-200 text-xs">
                    <div>
                      <div className="font-medium text-charcoal">{group.leader_name}</div>
                      <div className="text-[12px] text-muted">{group.leader_contact || "Primary Facilitator"}</div>
                    </div>
                    <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900">
                      Primary Leader
                    </span>
                  </div>

                  {group.assistant_leader_name && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-gray-200 text-xs">
                      <div>
                        <div className="font-medium text-charcoal">{group.assistant_leader_name}</div>
                        <div className="text-[12px] text-muted">{group.assistant_leader_contact || "Assistant Facilitator"}</div>
                      </div>
                      <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        Assistant Leader
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Historical Notice */}
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-[12px] text-charcoal/70 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                All past session roll-calls, discipleship notes, and progress logs are permanently referenced to the group that held them at that time.
              </span>
            </div>

          </div>
        )}

        {/* Footer */}
        <div data-modal-footer className="pt-2 border-t border-gray-100 flex items-center justify-between">
          <div>
            {activeTab === "all" && (
              <span className="text-[12px] text-muted">
                Total recorded transitions: <strong>{allTransitions.length}</strong>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-medium text-xs text-charcoal cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </ModalPanel>
    </div>,
    document.body
  );
};

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api";
import { BibleStudyGroup, Member, PrayerRequest, Announcement, StudyTopic, BibleStudyMember } from "../../types";
import { 
  BookOpen, Users, RefreshCw, X, Check, HeartHandshake, UserPlus, Send, CheckCircle2, AlertCircle
} from "lucide-react";

import { LeaderDashboard } from "./LeaderDashboard";
import { LeaderMembers } from "./LeaderMembers";
import { LeaderBibleStudy } from "./LeaderBibleStudy";

interface LeaderPortalPageProps {
  initialTab?: "dashboard" | "members" | "biblestudy";
  onTabChange?: (tab: "dashboard" | "members" | "biblestudy") => void;
}

export const LeaderPortalPage: React.FC<LeaderPortalPageProps> = ({ 
  initialTab = "dashboard",
  onTabChange
}) => {
  const { user, selectedMinistryId } = useAuth();

  // Active sub-view: "dashboard" | "members" | "biblestudy"
  const [activeTab, setActiveTab] = useState<"dashboard" | "members" | "biblestudy">(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleSelectTab = (tab: "dashboard" | "members" | "biblestudy") => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // State
  const [groups, setGroups] = useState<BibleStudyGroup[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [studyTopics, setStudyTopics] = useState<StudyTopic[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Group for detailed leader management
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  // Modals state
  const [isAddDiscipleModalOpen, setIsAddDiscipleModalOpen] = useState(false);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<number | "">("");

  // Quick Prayer Modal state
  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);
  const [prayerMemberId, setPrayerMemberId] = useState<number | null>(null);
  const [prayerTitle, setPrayerTitle] = useState("");
  const [prayerDescription, setPrayerDescription] = useState("");

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    loadLeaderData();
  }, [selectedMinistryId]);

  const loadLeaderData = async () => {
    try {
      setLoading(true);
      const [grps, mems, prs, anns, topics] = await Promise.all([
        api.getGroups({ ministry_id: selectedMinistryId ?? undefined }).catch(() => []),
        api.getMembers({ ministry_id: selectedMinistryId ?? undefined }).catch(() => []),
        api.getPrayerRequests({ ministry_id: selectedMinistryId ?? undefined }).catch(() => []),
        api.getAnnouncements(selectedMinistryId ?? undefined).catch(() => []),
        api.getStudyTopics({ ministry_id: selectedMinistryId ?? undefined }).catch(() => null)
      ]);

      // Filter groups designated to this leader
      const designatedGroups = (grps || []).filter(g => {
        if (!user || user.role_name !== "Leader") return true;
        const cleanUser = user.name.replace(/\(.*?\)/g, "").trim().toLowerCase();
        const cleanLeader = (g.leader_name || "").replace(/\(.*?\)/g, "").trim().toLowerCase();
        return cleanUser.includes(cleanLeader) || cleanLeader.includes(cleanUser) || g.leader_name === user.name;
      });

      const finalGroups = designatedGroups.length > 0 ? designatedGroups : grps;
      setGroups(finalGroups);
      setAllMembers(mems);
      setPrayers(prs);
      setAnnouncements(anns);
      setStudyTopics(topics?.all || []);

      if (finalGroups.length > 0 && (selectedGroupId === null || !finalGroups.some(g => g.id === selectedGroupId))) {
        setSelectedGroupId(finalGroups[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load leader data:", err);
      showToast(err.message || "Failed to load leader workspace", "error");
    } finally {
      setLoading(false);
    }
  };

  // Find active selected group
  const activeGroup = useMemo(() => {
    return groups.find(g => g.id === selectedGroupId) || groups[0] || null;
  }, [groups, selectedGroupId]);

  // Group disciples
  const groupDisciples: BibleStudyMember[] = useMemo(() => {
    if (!activeGroup || !activeGroup.members) return [];
    return activeGroup.members;
  }, [activeGroup]);

  // Available members not yet in this group
  const availableMembersToAdd = useMemo(() => {
    if (!activeGroup) return allMembers;
    const existingIds = new Set((activeGroup.members || []).map(m => m.member_id).filter(Boolean));
    return allMembers.filter(m => !existingIds.has(m.id));
  }, [allMembers, activeGroup]);

  // Add Disciple to Group
  const handleAddDisciple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !selectedMemberToAdd) return;

    try {
      await api.joinGroup(activeGroup.id, { member_id: Number(selectedMemberToAdd) });
      showToast(`✓ Disciple added to ${activeGroup.name}!`);
      setIsAddDiscipleModalOpen(false);
      setSelectedMemberToAdd("");
      loadLeaderData();
    } catch (err: any) {
      showToast(err.message || "Failed to add disciple", "error");
    }
  };

  // Submit Member Prayer Request
  const handleSubmitPrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayerTitle.trim() || !prayerDescription.trim()) return;

    try {
      await api.submitPrayerRequest({
        request_text: `[${prayerTitle.trim()}] ${prayerDescription.trim()}`,
        ministry_id: selectedMinistryId || (activeGroup ? activeGroup.ministry_id : 1),
        is_anonymous: false
      });

      showToast("✓ Prayer request logged to church prayer wall!");
      setIsPrayerModalOpen(false);
      setPrayerTitle("");
      setPrayerDescription("");
      setPrayerMemberId(null);
      loadLeaderData();
    } catch (err: any) {
      showToast(err.message || "Failed to post prayer request", "error");
    }
  };

  // Advance Chapter Progress
  const handleAdvanceChapter = async (topic: StudyTopic) => {
    try {
      const nextChapters = Math.min(topic.total_chapters, topic.completed_chapters + 1);
      const isCompleted = nextChapters >= topic.total_chapters;
      await api.updateStudyTopic(topic.id, {
        completed_chapters: nextChapters,
        status: isCompleted ? "completed" : "in_progress"
      });
      showToast(`✓ Progress updated: Chapter ${nextChapters} of ${topic.total_chapters} in ${topic.title}!`);
      loadLeaderData();
    } catch (err: any) {
      showToast(err.message || "Failed to update chapter progress", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold text-white border animate-in slide-in-from-bottom-4 ${
          toastMsg.type === "success" ? "bg-emerald-900 border-emerald-700" : "bg-rose-900 border-rose-700"
        }`}>
          {toastMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TOP LEADER HERO HEADER */}
      <div className="bg-gradient-to-r from-sky-950 via-indigo-950 to-sky-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-radial from-sky-400/15 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-sky-300 text-[11px] font-bold shadow-2xs backdrop-blur-md">
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>Small Group & Discipleship Leader Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Welcome, Leader {user?.name || "Daniel Cruz"}</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-500/30 text-sky-200 border border-sky-400/30">
                Leader
              </span>
            </h1>
            <p className="text-xs text-sky-200/90 max-w-xl leading-relaxed">
              Oversee your Bible study disciples, track weekly meeting attendance, guide curriculum progress, and pray for your group members.
            </p>
          </div>

          {/* Group Selector Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5 bg-white/10 p-2.5 rounded-2xl border border-white/15 backdrop-blur-md">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-sky-200 uppercase tracking-wider block">
                Active Life Group:
              </label>
              <select
                value={selectedGroupId || ""}
                onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                className="bg-indigo-950 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-white/20 outline-none cursor-pointer"
              >
                {groups.length === 0 ? (
                  <option value="">No Assigned Life Group</option>
                ) : (
                  groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.meeting_day})</option>
                  ))
                )}
              </select>
            </div>

            <button
              onClick={loadLeaderData}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all self-end"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Render Sub-Views */}
      {activeTab === "dashboard" && (
        <LeaderDashboard
          activeGroup={activeGroup}
          groupDisciples={groupDisciples}
          prayers={prayers}
          studyTopics={studyTopics}
          onNavigateTab={setActiveTab}
          onOpenPrayerModal={(m) => {
            if (m) {
              setPrayerMemberId(m.member_id || m.id);
              setPrayerTitle(`Prayer for ${m.member_name || `${m.first_name || ""} ${m.last_name || ""}`.trim()}`);
            } else {
              setPrayerMemberId(null);
              setPrayerTitle("");
            }
            setIsPrayerModalOpen(true);
          }}
          onAdvanceChapter={handleAdvanceChapter}
        />
      )}

      {activeTab === "members" && (
        <LeaderMembers
          activeGroup={activeGroup}
          groupDisciples={groupDisciples}
          onOpenAddDiscipleModal={() => setIsAddDiscipleModalOpen(true)}
          onOpenPrayerModal={(m) => {
            setPrayerMemberId(m.member_id || m.id);
            setPrayerTitle(`Prayer for ${m.member_name || `${m.first_name || ""} ${m.last_name || ""}`.trim()}`);
            setIsPrayerModalOpen(true);
          }}
        />
      )}

      {activeTab === "biblestudy" && (
        <LeaderBibleStudy
          activeGroup={activeGroup}
          groupDisciples={groupDisciples}
          onSaveAttendanceSession={(date, memberIds) => {
            showToast(`✓ Logged attendance for ${memberIds.length} disciples on ${date}!`);
          }}
          onGroupUpdated={loadLeaderData}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD DISCIPLE TO GROUP */}
      {/* ========================================================================= */}
      {isAddDiscipleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-900 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-charcoal">Add Disciple to Group</h3>
                  <p className="text-[11px] text-charcoal/50">Assign church member to {activeGroup?.name}</p>
                </div>
              </div>
              <button onClick={() => setIsAddDiscipleModalOpen(false)} className="p-1.5 text-charcoal/40 hover:text-charcoal rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDisciple} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-charcoal mb-1">Select Church Member *</label>
                <select
                  required
                  value={selectedMemberToAdd}
                  onChange={(e) => setSelectedMemberToAdd(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo bg-white"
                >
                  <option value="">-- Choose Member --</option>
                  {availableMembersToAdd.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.ministry_name || "Member"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddDiscipleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedMemberToAdd}
                  className="px-4 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5 text-amber-300" />
                  <span>Add to Group</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: POST PRAYER REQUEST */}
      {/* ========================================================================= */}
      {isPrayerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-charcoal">Post Group Prayer Request</h3>
                  <p className="text-[11px] text-charcoal/50">Submit prayer need to church prayer wall</p>
                </div>
              </div>
              <button onClick={() => setIsPrayerModalOpen(false)} className="p-1.5 text-charcoal/40 hover:text-charcoal rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPrayer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-charcoal mb-1">Prayer Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Healing and strength for Sister Elena"
                  value={prayerTitle}
                  onChange={(e) => setPrayerTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Prayer Details *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Share details of the prayer request..."
                  value={prayerDescription}
                  onChange={(e) => setPrayerDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo resize-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPrayerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-amber-300" />
                  <span>Submit Prayer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

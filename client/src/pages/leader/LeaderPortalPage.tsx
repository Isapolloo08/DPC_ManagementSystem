import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api";
import { useSocketEvent } from "../../socket";
import {
  BibleStudyGroup, Member, Announcement, StudyTopic,
  BibleStudyMember, SaturdayDutyScheduleItem, SundayDutyScheduleItem
} from "../../types";
import {
  BookOpen, Users, RefreshCw, X, Check, UserPlus, Send,
  CheckCircle2, AlertCircle, Plus, Sparkles, ShieldCheck, Heart,
} from "lucide-react";

import { LeaderDashboard } from "./LeaderDashboard";
import { LeaderMembers } from "./LeaderMembers";
import { LeaderBibleStudy } from "./LeaderBibleStudy";
import { DashboardSkeleton } from "../../components/common/SkeletonLoader";
import { NavTab } from "../../components/layout/Sidebar";

interface LeaderPortalPageProps {
  initialTab?: "dashboard" | "members" | "biblestudy";
  onTabChange?: (tab: "dashboard" | "members" | "biblestudy") => void;
  onNavigateGeneralTab?: (tab: NavTab) => void;
}

export const LeaderPortalPage: React.FC<LeaderPortalPageProps> = ({
  initialTab = "dashboard",
  onTabChange,
  onNavigateGeneralTab
}) => {
  const { user, selectedMinistryId } = useAuth();
  const isLeaderOrHigher = user?.role_name === "Leader" || user?.role_name === "Coordinator" || user?.role_name === "Admin";

  // Active sub-view: "dashboard" (My Group - Member) | "members" (Group Members - Leader) | "biblestudy" (Attendance & Curriculum)
  const [activeTab, setActiveTab] = useState<"dashboard" | "members" | "biblestudy">(
    !isLeaderOrHigher ? "dashboard" : initialTab
  );

  useEffect(() => {
    if (!isLeaderOrHigher) {
      setActiveTab("dashboard");
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isLeaderOrHigher]);

  const handleSelectTab = (tab: "dashboard" | "members" | "biblestudy") => {
    if (!isLeaderOrHigher && tab !== "dashboard") return;
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // State
  const [allGroups, setAllGroups] = useState<BibleStudyGroup[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [studyTopics, setStudyTopics] = useState<StudyTopic[]>([]);
  const [designatedDuties, setDesignatedDuties] = useState<SaturdayDutyScheduleItem[]>([]);
  const [designatedDishwashing, setDesignatedDishwashing] = useState<SundayDutyScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Group selection IDs
  const [selectedLedGroupId, setSelectedLedGroupId] = useState<number | null>(null);
  const [selectedMemberGroupId, setSelectedMemberGroupId] = useState<number | null>(null);

  // Modals state
  const [isAddDiscipleModalOpen, setIsAddDiscipleModalOpen] = useState(false);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<number | "">("");

  // Create Lead Group Modal State
  const [isCreateLeadGroupModalOpen, setIsCreateLeadGroupModalOpen] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({
    name: "",
    description: "",
    meeting_day: "Wednesday",
    meeting_time_start: "7:00 PM",
    meeting_time_end: "8:30 PM",
    location: "Main Sanctuary",
    curriculum: "General Study",
    category: "General",
    max_capacity: 12
  });

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    loadLeaderData();
  }, [selectedMinistryId, user?.id, user?.name]);

  // Real-time synchronization
  useSocketEvent("groups:changed", () => loadLeaderData());
  useSocketEvent("members:changed", () => loadLeaderData());
  useSocketEvent("communications:changed", () => loadLeaderData());
  useSocketEvent("study_topics:changed", () => loadLeaderData());
  useSocketEvent("attendance:changed", () => loadLeaderData());
  useSocketEvent("duty:changed", () => loadLeaderData());
  useSocketEvent("dishwashing:changed", () => loadLeaderData());

  const loadLeaderData = async () => {
    try {
      setLoading(true);
      const [grps, mems, anns, topics, dutyRes, dishRes] = await Promise.all([
        api.getGroups({ ministry_id: selectedMinistryId ?? undefined }).catch(() => []),
        api.getMembers({ ministry_id: selectedMinistryId ?? undefined }).catch(() => []),
        api.getAnnouncements(selectedMinistryId ?? undefined).catch(() => []),
        api.getStudyTopics({ ministry_id: selectedMinistryId ?? undefined }).catch(() => null),
        api.getDutySchedule({ ministry_id: selectedMinistryId ?? undefined, count: 12 }).catch(() => ({ schedule: [] })),
        api.getDishwashingSchedule({ count: 12 }).catch(() => ({ schedule: [] }))
      ]);

      const rawGroups: BibleStudyGroup[] = grps || [];
      setAllGroups(rawGroups);
      setAllMembers(mems || []);

      const cleanUser = user ? user.name.replace(/\(.*?\)/g, "").trim().toLowerCase() : "";
      const userMemberId = (user as any)?.member_id;

      setAnnouncements(anns || []);
      setStudyTopics(topics?.all || []);

      // Filter Saturday Duties designated to this leader
      const myDuties = (dutyRes?.schedule || []).filter((d: SaturdayDutyScheduleItem) => {
        if (!user || user.role_name !== "Leader") return true;
        if (!d.team) return false;
        const leaderName = (d.team.leader_name || "").replace(/\(.*?\)/g, "").trim().toLowerCase();
        if (leaderName && (leaderName === cleanUser || cleanUser.includes(leaderName) || leaderName.includes(cleanUser))) return true;
        if (userMemberId && d.team.leader_id === userMemberId) return true;
        if (d.team.members && d.team.members.some((m: any) => m.id === userMemberId || (m.name && m.name.toLowerCase().includes(cleanUser)))) return true;
        return false;
      });
      setDesignatedDuties(myDuties);

      // Filter Sunday Dishwashing Duties designated to this leader
      const myDishwashing = (dishRes?.schedule || []).filter((d: SundayDutyScheduleItem) => {
        if (!user || user.role_name !== "Leader") return true;
        if (!d.team) return false;
        const leaderName = (d.team.leader_name || "").replace(/\(.*?\)/g, "").trim().toLowerCase();
        if (leaderName && (leaderName === cleanUser || cleanUser.includes(leaderName) || leaderName.includes(cleanUser))) return true;
        if (userMemberId && d.team.leader_id === userMemberId) return true;
        if (d.team.members && d.team.members.some((m: any) => m.id === userMemberId || (m.name && m.name.toLowerCase().includes(cleanUser)))) return true;
        return false;
      });
      setDesignatedDishwashing(myDishwashing);

    } catch (err: any) {
      console.error("Failed to load leader data:", err);
      showToast(err.message || "Failed to load leader workspace", "error");
    } finally {
      setLoading(false);
    }
  };

  // 1. CLASSIFY: Groups where user is the LEADER
  const myLedGroups = useMemo(() => {
    const cleanUser = user ? user.name.replace(/\(.*?\)/g, "").trim().toLowerCase() : "";
    const userEmail = user ? user.email.trim().toLowerCase() : "";
    const userUsername = user?.username ? user.username.trim().toLowerCase() : "";
    const userMemberId = (user as any)?.member_id;
    const userLinkedName = ((user as any)?.linked_member_name || "").trim().toLowerCase();

    const matched = allGroups.filter(g => {
      // Leader name match
      const cleanLeader = (g.leader_name || "").replace(/\(.*?\)/g, "").trim().toLowerCase();
      if (cleanLeader) {
        if (cleanUser === cleanLeader || cleanUser.includes(cleanLeader) || cleanLeader.includes(cleanUser)) return true;
        if (userLinkedName && (userLinkedName === cleanLeader || userLinkedName.includes(cleanLeader) || cleanLeader.includes(userLinkedName))) return true;
      }
      // Leader contact match
      const cleanContact = (g.leader_contact || "").trim().toLowerCase();
      if (cleanContact && (cleanContact === userEmail || cleanContact === userUsername)) return true;
      // Leader ID match
      if (user?.id && (g as any).leader_id === user.id) return true;
      if (userMemberId && (g as any).leader_id === userMemberId) return true;

      return false;
    });

    // If Admin/Coordinator has no specifically designated led group, allow managing any group
    if (matched.length === 0 && (user?.role_name === "Admin" || user?.role_name === "Coordinator")) {
      return allGroups;
    }
    return matched;
  }, [allGroups, user]);

  // 2. CLASSIFY: Groups where user is an enrolled MEMBER
  const myMemberGroups = useMemo(() => {
    const cleanUser = user ? user.name.replace(/\(.*?\)/g, "").trim().toLowerCase() : "";
    const userMemberId = (user as any)?.member_id;

    return allGroups.filter(g => {
      if (!g.members || g.members.length === 0) return false;
      return g.members.some((m: any) => {
        if (userMemberId && m.member_id === userMemberId) return true;
        const mName = (m.member_name || `${m.first_name || ""} ${m.last_name || ""}`).trim().toLowerCase();
        return mName && (mName === cleanUser || cleanUser.includes(mName) || mName.includes(cleanUser));
      });
    });
  }, [allGroups, user]);

  // Auto-select initial IDs
  useEffect(() => {
    if (myLedGroups.length > 0 && (!selectedLedGroupId || !myLedGroups.some(g => g.id === selectedLedGroupId))) {
      setSelectedLedGroupId(myLedGroups[0].id);
    }
  }, [myLedGroups, selectedLedGroupId]);

  useEffect(() => {
    if (myMemberGroups.length > 0 && (!selectedMemberGroupId || !myMemberGroups.some(g => g.id === selectedMemberGroupId))) {
      setSelectedMemberGroupId(myMemberGroups[0].id);
    }
  }, [myMemberGroups, selectedMemberGroupId]);

  // Active Led Group (for Group Members and Meeting Attendance tabs)
  const activeLedGroup = useMemo(() => {
    return myLedGroups.find(g => g.id === selectedLedGroupId) || myLedGroups[0] || null;
  }, [myLedGroups, selectedLedGroupId]);

  // Active Member Group (for My Group tab)
  const activeMemberGroup = useMemo(() => {
    return myMemberGroups.find(g => g.id === selectedMemberGroupId) || myMemberGroups[0] || null;
  }, [myMemberGroups, selectedMemberGroupId]);

  // Dynamic active group depending on view mode
  const activeGroup = activeTab === "dashboard" ? activeMemberGroup : activeLedGroup;

  // Active group members
  const currentMembers: BibleStudyMember[] = useMemo(() => {
    if (!activeGroup || !activeGroup.members) return [];
    return activeGroup.members;
  }, [activeGroup]);

  // Available members not yet in the active led group
  const availableMembersToAdd = useMemo(() => {
    const existingIds = new Set((activeLedGroup?.members || []).map(d => d.member_id).filter(Boolean));
    return allMembers.filter(m => !existingIds.has(m.id));
  }, [allMembers, activeLedGroup]);

  if (loading && allGroups.length === 0) {
    return <DashboardSkeleton />;
  }

  // Handle Add Member to Led Group
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLedGroup || !selectedMemberToAdd) return;

    try {
      await api.joinGroup(activeLedGroup.id, { member_id: Number(selectedMemberToAdd) });
      showToast(`✓ Member added to ${activeLedGroup.name}!`);
      setIsAddDiscipleModalOpen(false);
      setSelectedMemberToAdd("");
      loadLeaderData();
    } catch (err: any) {
      showToast(err.message || "Failed to add member", "error");
    }
  };

  // Handle Create New Led Group
  const handleCreateLeadGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupForm.name.trim()) return;

    try {
      setIsCreatingGroup(true);
      const meetingTimeStr = newGroupForm.meeting_time_end
        ? `${newGroupForm.meeting_time_start} - ${newGroupForm.meeting_time_end}`
        : newGroupForm.meeting_time_start;

      await api.createGroup({
        name: newGroupForm.name.trim(),
        description: newGroupForm.description.trim(),
        curriculum: newGroupForm.curriculum.trim() || "General Study",
        ministry_id: selectedMinistryId || 1,
        leader_name: user?.name || "Life Group Leader",
        leader_contact: user?.email || user?.username || "",
        meeting_day: newGroupForm.meeting_day,
        meeting_time: meetingTimeStr,
        location: newGroupForm.location.trim() || "Main Sanctuary",
        category: newGroupForm.category,
        max_capacity: Number(newGroupForm.max_capacity) || 12,
        current_chapter: "Chapter 1",
        progress_stage: "in_progress",
        progress_notes: ""
      });

      showToast(`✓ New Life Group "${newGroupForm.name}" created!`);
      setIsCreateLeadGroupModalOpen(false);
      setNewGroupForm({
        name: "",
        description: "",
        meeting_day: "Wednesday",
        meeting_time_start: "7:00 PM",
        meeting_time_end: "8:30 PM",
        location: "Main Sanctuary",
        curriculum: "General Study",
        category: "General",
        max_capacity: 12
      });
      loadLeaderData();
    } catch (err: any) {
      showToast(err.message || "Failed to create lead group", "error");
    } finally {
      setIsCreatingGroup(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold text-white border animate-in slide-in-from-bottom-4 ${toastMsg.type === "success" ? "bg-emerald-900 border-emerald-700" : "bg-rose-900 border-rose-700"
          }`}>
          {toastMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TOP DYNAMIC HERO HEADER */}
      <div className="bg-gradient-to-r from-sky-950 via-indigo-950 to-sky-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-radial from-sky-400/15 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            {activeTab === "dashboard" || !isLeaderOrHigher ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-[11px] font-bold shadow-2xs backdrop-blur-md">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>My Bible Study Group</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[11px] font-bold shadow-2xs backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>My Led Discipleship Group (Leader View)</span>
              </div>
            )}

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5 flex-wrap">
              <span>{activeGroup ? activeGroup.name : (activeTab === "dashboard" || !isLeaderOrHigher ? "My Bible Study Group" : "My Discipleship Group")}</span>
              {activeGroup && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/15 text-sky-200 border border-white/20">
                  {activeGroup.meeting_day} • {activeGroup.meeting_time || "7:00 PM"}
                </span>
              )}
            </h1>

            <p className="text-xs text-sky-200/90 max-w-xl leading-relaxed">
              {activeTab === "dashboard" || !isLeaderOrHigher
                ? (activeMemberGroup
                  ? `Your enrolled Bible study group led by ${activeMemberGroup.leader_name || "Assigned Leader"}. Weekly biblical study, fellowship, and spiritual care.`
                  : "Your personal Bible study small group where you attend and grow with fellow disciples.")
                : (activeLedGroup
                  ? `Discipleship life group under your leadership. Guide group members, record weekly attendance, and lead Scripture curriculum.`
                  : "Manage your small group members, track meeting roll-call, and lead curriculum.")}
            </p>
          </div>

          {/* Group Switcher / Actions */}
          <div className="flex flex-wrap items-center gap-2.5 bg-white/10 p-2.5 rounded-2xl border border-white/15 backdrop-blur-md">
            {activeTab === "dashboard" || !isLeaderOrHigher ? (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-sky-200 uppercase tracking-wider block">
                  Enrolled Group:
                </label>
                <select
                  value={selectedMemberGroupId || ""}
                  onChange={(e) => setSelectedMemberGroupId(Number(e.target.value))}
                  className="bg-indigo-950 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl border border-white/20 outline-none cursor-pointer"
                >
                  {myMemberGroups.length === 0 ? (
                    <option value="">No Enrolled Group</option>
                  ) : (
                    myMemberGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} (Led by {g.leader_name || "Leader"})</option>
                    ))
                  )}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-sky-200 uppercase tracking-wider block">
                  Led Life Group:
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedLedGroupId || ""}
                    onChange={(e) => setSelectedLedGroupId(Number(e.target.value))}
                    className="bg-indigo-950 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl border border-white/20 outline-none cursor-pointer"
                  >
                    {myLedGroups.length === 0 ? (
                      <option value="">No Led Group Assigned</option>
                    ) : (
                      myLedGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.meeting_day})</option>
                      ))
                    )}
                  </select>

                  <button
                    onClick={() => setIsCreateLeadGroupModalOpen(true)}
                    className="p-1.5 px-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-bold text-xs border border-amber-300/30 transition-all flex items-center gap-1 cursor-pointer"
                    title="Add a group you will lead"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Add Lead Group</span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={loadLeaderData}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all self-end cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* In-Page Sub-View Navigation Tabs - Only for Leaders, Pastors/Admins, and Coordinators */}
      {isLeaderOrHigher && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => handleSelectTab("dashboard")}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === "dashboard"
                ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
          >
            <Heart className={`w-3.5 h-3.5 ${activeTab === "dashboard" ? "text-rose-400" : "text-slate-400"}`} />
            <span>My Group (Member)</span>
            {myMemberGroups.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-bold">
                {myMemberGroups.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSelectTab("members")}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === "members"
                ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
          >
            <Users className={`w-3.5 h-3.5 ${activeTab === "members" ? "text-sky-400" : "text-slate-400"}`} />
            <span>Lead Group (Disciples: {activeLedGroup?.members?.length || 0})</span>
          </button>

          <button
            onClick={() => handleSelectTab("biblestudy")}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === "biblestudy"
                ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
          >
            <BookOpen className={`w-3.5 h-3.5 ${activeTab === "biblestudy" ? "text-amber-400" : "text-slate-400"}`} />
            <span>Meeting Attendance & Curriculum</span>
          </button>
        </div>
      )}

      {/* Render Sub-Views */}
      {activeTab === "dashboard" && (
        <LeaderDashboard
          activeGroup={myLedGroups.length > 0 ? (activeLedGroup || myLedGroups[0]) : activeMemberGroup}
          groupDisciples={(myLedGroups.length > 0 ? (activeLedGroup?.members || myLedGroups[0]?.members) : activeMemberGroup?.members) || []}
          studyTopics={studyTopics}
          designatedDuties={designatedDuties}
          designatedDishwashing={designatedDishwashing}
          isMemberView={myLedGroups.length === 0 && user?.role_name !== "Leader"}
          onNavigateTab={setActiveTab}
          onNavigateGeneralTab={onNavigateGeneralTab}
        />
      )}

      {activeTab === "members" && (
        <LeaderMembers
          activeGroup={activeLedGroup}
          groupDisciples={activeLedGroup?.members || []}
          ledGroups={myLedGroups}
          selectedGroupId={selectedLedGroupId}
          onSelectGroup={(id) => setSelectedLedGroupId(id)}
          onOpenAddDiscipleModal={() => setIsAddDiscipleModalOpen(true)}
          onOpenCreateGroupModal={() => setIsCreateLeadGroupModalOpen(true)}
        />
      )}

      {activeTab === "biblestudy" && (
        <LeaderBibleStudy
          activeGroup={activeLedGroup}
          groupDisciples={activeLedGroup?.members || []}
          onSaveAttendanceSession={(date, memberIds) => {
            showToast(`✓ Logged attendance for ${memberIds.length} members on ${date}!`);
          }}
          onGroupUpdated={loadLeaderData}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD MEMBER TO LED GROUP */}
      {/* ========================================================================= */}
      {isAddDiscipleModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-900 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-charcoal">Add Member to Group</h3>
                  <p className="text-[11px] text-charcoal/50">Enroll member in {activeLedGroup?.name}</p>
                </div>
              </div>
              <button onClick={() => setIsAddDiscipleModalOpen(false)} className="p-1.5 text-charcoal/40 hover:text-charcoal rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4 text-xs">
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
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedMemberToAdd}
                  className="px-4 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-amber-300" />
                  <span>Add to Group</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / ADD LEAD GROUP */}
      {/* ========================================================================= */}
      {isCreateLeadGroupModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-charcoal">Create Life Group to Lead</h3>
                  <p className="text-[11px] text-charcoal/50">Leader: {user?.name || "You"}</p>
                </div>
              </div>
              <button onClick={() => setIsCreateLeadGroupModalOpen(false)} className="p-1.5 text-charcoal/40 hover:text-charcoal rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLeadGroup} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-charcoal mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Young Adults Discipleship Group"
                  value={newGroupForm.name}
                  onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-charcoal mb-1">Meeting Day *</label>
                  <select
                    value={newGroupForm.meeting_day}
                    onChange={(e) => setNewGroupForm({ ...newGroupForm, meeting_day: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo bg-white"
                  >
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-charcoal mb-1">Max Capacity</label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={newGroupForm.max_capacity}
                    onChange={(e) => setNewGroupForm({ ...newGroupForm, max_capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-charcoal mb-1">Time Start</label>
                  <input
                    type="text"
                    placeholder="7:00 PM"
                    value={newGroupForm.meeting_time_start}
                    onChange={(e) => setNewGroupForm({ ...newGroupForm, meeting_time_start: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal mb-1">Time End</label>
                  <input
                    type="text"
                    placeholder="8:30 PM"
                    value={newGroupForm.meeting_time_end}
                    onChange={(e) => setNewGroupForm({ ...newGroupForm, meeting_time_end: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Meeting Location</label>
                <input
                  type="text"
                  placeholder="e.g. Main Sanctuary / Room 201"
                  value={newGroupForm.location}
                  onChange={(e) => setNewGroupForm({ ...newGroupForm, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Curriculum Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Book of Romans / Foundations of Faith"
                  value={newGroupForm.curriculum}
                  onChange={(e) => setNewGroupForm({ ...newGroupForm, curriculum: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Description / Group Vision</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of the life group..."
                  value={newGroupForm.description}
                  onChange={(e) => setNewGroupForm({ ...newGroupForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo resize-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateLeadGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGroup || !newGroupForm.name.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isCreatingGroup ? "Creating..." : "Create Group"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

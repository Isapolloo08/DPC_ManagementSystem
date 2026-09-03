import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { DutyTeam, SaturdayDutyScheduleItem, Member } from "../types";
import { 
  CalendarCheck, Users, ShieldCheck, CheckCircle2, Clock, Plus, 
  Trash2, Edit, RefreshCw, ArrowLeftRight, Sparkles, Check, X, 
  AlertCircle, ChevronRight, Phone, CheckSquare, Sparkle, Calendar,
  Crown, UserPlus
} from "lucide-react";

export const DutyPage: React.FC = () => {
  const { user, ministries, selectedMinistryId } = useAuth();
  const isCoordinator = user?.role_name === "Coordinator";
  const coordinatorMinistryId = isCoordinator && user?.ministries && user.ministries.length > 0 
    ? user.ministries[0].id 
    : (user?.role_name !== "Admin" && selectedMinistryId ? selectedMinistryId : null);
  const coordinatorMinistryName = user?.ministries && user.ministries.length > 0 ? user.ministries[0].name : "Youth";
  const activeScope = coordinatorMinistryId ?? selectedMinistryId ?? undefined;

  const [activeTab, setActiveTab] = useState<"teams" | "schedule" | "tasks">("teams");
  const [teams, setTeams] = useState<DutyTeam[]>([]);
  const [schedule, setSchedule] = useState<SaturdayDutyScheduleItem[]>([]);
  const [churchMembers, setChurchMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Team modal state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<DutyTeam | null>(null);
  const [teamForm, setTeamForm] = useState({
    name: "",
    order_seq: 1,
    leader_id: "",
    color: "#2C3968",
    tasks_checklist: "Sanctuary Cleaning, Sound Setup, Trash Disposal, Restroom Sanitization"
  });

  // Add member modal state
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [targetTeam, setTargetTeam] = useState<DutyTeam | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberRole, setMemberRole] = useState<"Member" | "Team Leader">("Member");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // Swap modal state
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapItem1, setSwapItem1] = useState<SaturdayDutyScheduleItem | null>(null);
  const [swapTargetDate, setSwapTargetDate] = useState<string>("");

  // Complete duty modal state
  const [completingItem, setCompletingItem] = useState<SaturdayDutyScheduleItem | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");

  useEffect(() => {
    loadDutyData();
  }, [selectedMinistryId, coordinatorMinistryId]);

  const loadDutyData = async () => {
    try {
      setLoading(true);
      const [teamsData, scheduleData, membersData] = await Promise.all([
        api.getDutyTeams(activeScope),
        api.getDutySchedule({ ministry_id: activeScope, count: 12 }),
        api.getMembers({ ministry_id: activeScope, status: "active" })
      ]);
      setTeams(teamsData);
      setSchedule(scheduleData.schedule);
      setChurchMembers(membersData);
    } catch (err) {
      console.error("Failed to load duty roster:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateTeam = () => {
    setEditingTeam(null);
    const nextNum = teams.length + 1;
    setTeamForm({
      name: `Team ${nextNum}`,
      order_seq: nextNum,
      leader_id: "",
      color: nextNum % 2 === 1 ? "#2C3968" : "#E07A5F",
      tasks_checklist: "Sanctuary Cleaning, Trash Disposal, Sound & Audio Checks, Restroom Sanitization"
    });
    setIsTeamModalOpen(true);
  };

  const handleOpenEditTeam = (team: DutyTeam) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      order_seq: team.order_seq,
      leader_id: team.leader_id ? String(team.leader_id) : "",
      color: team.color,
      tasks_checklist: team.tasks_checklist || ""
    });
    setIsTeamModalOpen(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTeam) {
        await api.updateDutyTeam(editingTeam.id, {
          name: teamForm.name,
          order_seq: Number(teamForm.order_seq),
          leader_id: teamForm.leader_id ? Number(teamForm.leader_id) : null,
          color: teamForm.color,
          tasks_checklist: teamForm.tasks_checklist
        });
      } else {
        await api.createDutyTeam({
          name: teamForm.name,
          order_seq: Number(teamForm.order_seq),
          ministry_id: coordinatorMinistryId || null,
          leader_id: teamForm.leader_id ? Number(teamForm.leader_id) : null,
          color: teamForm.color,
          tasks_checklist: teamForm.tasks_checklist
        });
      }
      setIsTeamModalOpen(false);
      loadDutyData();
    } catch (err: any) {
      alert(err.message || "Failed to save team");
    }
  };

  const handleDeleteTeam = async (teamId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await api.deleteDutyTeam(teamId);
      loadDutyData();
    } catch (err: any) {
      alert(err.message || "Failed to delete team");
    }
  };

  const handleOpenAddMember = (team: DutyTeam) => {
    setTargetTeam(team);
    setSelectedMemberId("");
    setMemberRole("Member");
    setMemberSearchQuery("");
    setIsAddMemberModalOpen(true);
  };

  const handleAddMemberToTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeam || !selectedMemberId) return;
    try {
      await api.addDutyTeamMember(targetTeam.id, {
        member_id: Number(selectedMemberId),
        role: memberRole
      });
      setIsAddMemberModalOpen(false);
      loadDutyData();
    } catch (err: any) {
      alert(err.message || "Failed to add member to team");
    }
  };

  const handleRemoveMember = async (teamId: number, memberId: number, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this duty team?`)) return;
    try {
      await api.removeDutyTeamMember(teamId, memberId);
      loadDutyData();
    } catch (err: any) {
      alert(err.message || "Failed to remove member");
    }
  };

  const handleOpenSwapModal = (item: SaturdayDutyScheduleItem) => {
    setSwapItem1(item);
    const availableDates = schedule.filter(s => s.duty_date !== item.duty_date);
    setSwapTargetDate(availableDates[0]?.duty_date || "");
    setIsSwapModalOpen(true);
  };

  const handleExecuteSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapItem1 || !swapTargetDate) return;
    const targetItem = schedule.find(s => s.duty_date === swapTargetDate);
    if (!targetItem || !swapItem1.team || !targetItem.team) {
      alert("Both Saturdays must have teams assigned to swap");
      return;
    }

    try {
      await api.swapSaturdayDuty({
        date1: swapItem1.duty_date,
        teamId1: swapItem1.team.id,
        date2: targetItem.duty_date,
        teamId2: targetItem.team.id,
        ministry_id: coordinatorMinistryId || null
      });
      setIsSwapModalOpen(false);
      loadDutyData();
    } catch (err: any) {
      alert(err.message || "Failed to swap duty teams");
    }
  };

  const handleCompleteDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingItem || !completingItem.team) return;
    try {
      await api.completeSaturdayDuty({
        duty_date: completingItem.duty_date,
        team_id: completingItem.team.id,
        ministry_id: coordinatorMinistryId || null,
        notes: completionNotes || completingItem.notes || "Completed on schedule"
      });
      setCompletingItem(null);
      loadDutyData();
    } catch (err: any) {
      alert(err.message || "Failed to complete duty");
    }
  };

  // Find this Saturday's item
  const thisSaturday = schedule[0] || null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-indigo" />
            <span>Saturday Duty Roster & Rotating Teams</span>
            {coordinatorMinistryId && (
              <span className="text-xs bg-indigo-50 text-indigo border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
                {coordinatorMinistryName} Scope
              </span>
            )}
          </h1>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Weekly Saturday service preparation, church facility cleaning, and rotating team duty cycle.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDutyData}
            className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-charcoal/70 transition-all shadow-2xs"
            title="Refresh schedule"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo" : ""}`} />
          </button>
          <button
            onClick={handleOpenCreateTeam}
            className="flex items-center gap-1.5 bg-indigo hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Team</span>
          </button>
        </div>
      </div>

      {/* Hero Card: THIS SATURDAY'S ON-DUTY TEAM */}
      {thisSaturday && thisSaturday.team && (
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-indigo-800">
          <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none rounded-full blur-2xl"></div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="bg-amber-400 text-indigo-950 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm animate-pulse">
                  <Clock className="w-3 h-3" />
                  <span>THIS SATURDAY ON DUTY</span>
                </span>
                <span className="text-xs text-indigo-200 font-semibold">
                  {thisSaturday.date_formatted}
                </span>
                {thisSaturday.status === "completed" && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Completed</span>
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-black text-amber-300 flex items-center gap-3">
                  <span>{thisSaturday.team.name}</span>
                  <span 
                    className="w-3 h-3 rounded-full border border-white/50 inline-block" 
                    style={{ backgroundColor: thisSaturday.team.color }}
                  ></span>
                </h2>
                <p className="text-xs text-indigo-200 mt-1 max-w-xl">
                  Responsibilities: {thisSaturday.notes || thisSaturday.team.tasks_checklist || "Sanctuary Cleaning, Restrooms, Trash, Audio Setup"}
                </p>
              </div>

              {/* Leader & Roster Preview */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 flex items-center gap-2">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold">
                    Leader: <strong className="text-white">{thisSaturday.team.leader_name || "Unassigned"}</strong>
                  </span>
                  {thisSaturday.team.leader_phone && (
                    <span className="text-[11px] text-indigo-200 font-mono">({thisSaturday.team.leader_phone})</span>
                  )}
                </div>

                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="text-xs font-semibold">
                    Team Strength: <strong className="text-white">{thisSaturday.team.members?.length || thisSaturday.team.members_count || 0} Members</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
              {thisSaturday.status !== "completed" ? (
                <button
                  onClick={() => {
                    setCompletingItem(thisSaturday);
                    setCompletionNotes("");
                  }}
                  className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Duty Completed</span>
                </button>
              ) : (
                <div className="text-xs text-emerald-300 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-3 py-2 rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Finished for {thisSaturday.date_formatted}</span>
                </div>
              )}

              <button
                onClick={() => handleOpenSwapModal(thisSaturday)}
                className="flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 text-white font-bold text-xs py-2.5 px-4 rounded-xl border border-white/20 transition-all active:scale-95"
              >
                <ArrowLeftRight className="w-4 h-4 text-amber-300" />
                <span>Swap Saturday Team</span>
              </button>
            </div>
          </div>

          {/* Member chips row */}
          {thisSaturday.team.members && thisSaturday.team.members.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Duty Disciples:</span>
              {thisSaturday.team.members.map((m, idx) => (
                <span
                  key={idx}
                  className="bg-white/10 hover:bg-white/20 border border-white/10 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-100 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>{m.first_name} {m.last_name}</span>
                  {m.team_role === "Team Leader" && (
                    <span className="text-[9px] bg-amber-400 text-indigo-950 font-black px-1 rounded">LEAD</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab("teams")}
          className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${
            activeTab === "teams"
              ? "bg-indigo text-white shadow-xs"
              : "text-charcoal/70 hover:bg-gray-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Duty Teams ({teams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${
            activeTab === "schedule"
              ? "bg-indigo text-white shadow-xs"
              : "text-charcoal/70 hover:bg-gray-100"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Saturday Rotation Cycle ({schedule.length} Weeks)</span>
        </button>

        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${
            activeTab === "tasks"
              ? "bg-indigo text-white shadow-xs"
              : "text-charcoal/70 hover:bg-gray-100"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Saturday Cleaning & Duty Checklist</span>
        </button>
      </div>

      {/* TAB 1: TEAMS MANAGEMENT */}
      {activeTab === "teams" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-white rounded-2xl border border-gray-200/90 hover:border-indigo-200 shadow-2xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Team Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-4 h-4 rounded-full shadow-2xs"
                        style={{ backgroundColor: team.color }}
                      ></span>
                      <div>
                        <h3 className="font-bold text-base text-charcoal">{team.name}</h3>
                        <span className="text-[10px] text-indigo font-bold bg-indigo-50 px-2 py-0.5 rounded">
                          Cycle Turn #{team.order_seq}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditTeam(team)}
                        className="p-1.5 text-charcoal/50 hover:text-indigo hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Team"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team.id, team.name)}
                        className="p-1.5 text-charcoal/50 hover:text-rose hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Leader Banner */}
                  <div className="mt-3 bg-ivory-light p-2.5 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <div>
                        <span className="text-[10px] text-charcoal/50 block font-semibold">Team Leader</span>
                        <span className="font-bold text-charcoal">{team.leader_name || "Unassigned"}</span>
                      </div>
                    </div>
                    {team.leader_phone && (
                      <span className="text-[10px] text-indigo font-mono font-medium">{team.leader_phone}</span>
                    )}
                  </div>

                  {/* Member Roster Chips */}
                  <div className="mt-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-charcoal/70">
                      <span>Assigned Members ({team.members?.length || 0})</span>
                      <button
                        onClick={() => handleOpenAddMember(team)}
                        className="text-indigo hover:text-indigo-700 text-[11px] flex items-center gap-1 font-bold"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Member</span>
                      </button>
                    </div>

                    {team.members && team.members.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {team.members.map((m) => (
                          <div
                            key={m.member_id}
                            className="flex items-center justify-between p-2 rounded-xl bg-ivory-light/70 hover:bg-ivory-light border border-gray-100 text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo/40"></span>
                              <span className="font-semibold text-charcoal">
                                {m.first_name} {m.last_name}
                              </span>
                              {m.team_role === "Team Leader" && (
                                <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded">
                                  Lead
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleRemoveMember(team.id, m.member_id, `${m.first_name} ${m.last_name}`)}
                              className="p-1 text-charcoal/40 hover:text-rose hover:bg-white rounded transition-colors"
                              title="Remove from team"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-gray-200 text-center text-xs text-charcoal/50">
                        No members assigned yet.
                        <button
                          onClick={() => handleOpenAddMember(team)}
                          className="block mx-auto mt-1 text-indigo font-bold underline"
                        >
                          + Add first member
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Footer Checklist Preview */}
                <div className="pt-3 border-t border-gray-100 text-[11px] text-charcoal/60 line-clamp-2">
                  <span className="font-bold text-charcoal/80">Duty Checklist:</span>{" "}
                  {team.tasks_checklist || "General Saturday sanctuary cleaning and preparations."}
                </div>
              </div>
            ))}
          </div>

          {teams.length === 0 && !loading && (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-200">
              <Users className="w-12 h-12 text-charcoal/30 mx-auto mb-3" />
              <h3 className="font-bold text-charcoal text-base">No Duty Teams Created</h3>
              <p className="text-xs text-charcoal/60 mt-1 max-w-sm mx-auto">
                Create Team 1, Team 2, and more to set up a seamless rotating Saturday duty cycle.
              </p>
              <button
                onClick={handleOpenCreateTeam}
                className="mt-4 bg-indigo text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm"
              >
                + Create Team 1
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SATURDAY ROTATION CYCLE TIMELINE */}
      {activeTab === "schedule" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo" />
                <span>Upcoming Saturday Rotation Schedule</span>
              </h2>
              <p className="text-xs text-charcoal/50">
                Teams automatically cycle every Saturday ({teams.length}-week repeat interval).
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              Cycle Active: {teams.length} Teams
            </span>
          </div>

          <div className="space-y-3">
            {schedule.map((item, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  item.is_this_saturday
                    ? "bg-indigo-50/60 border-indigo-200 shadow-xs ring-2 ring-indigo-300/30"
                    : item.status === "completed"
                    ? "bg-emerald-50/40 border-emerald-200/80"
                    : "bg-white border-gray-100 hover:border-indigo-100"
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Week & Date badge */}
                  <div className="w-28 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50 block">
                      Week {item.week_number}
                    </span>
                    <span className="text-xs font-bold text-charcoal block">
                      {item.date_formatted}
                    </span>
                    {item.is_this_saturday && (
                      <span className="text-[9px] bg-amber-500 text-white font-black px-1.5 py-0.2 rounded-full uppercase tracking-wide inline-block mt-0.5 animate-pulse">
                        This Saturday
                      </span>
                    )}
                  </div>

                  {/* Team Assignment */}
                  {item.team ? (
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: item.team.color }}
                      ></span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-charcoal">{item.team.name}</h4>
                          <span className="text-[10px] text-charcoal/50 font-medium">
                            ({item.team.members?.length || item.team.members_count || 0} Members)
                          </span>
                        </div>
                        <span className="text-[11px] text-charcoal/60">
                          Leader: <strong className="text-charcoal font-semibold">{item.team.leader_name || "Assigned"}</strong>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-rose font-bold">No team assigned</span>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {item.status === "completed" ? (
                    <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Duty Completed</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setCompletingItem(item);
                        setCompletionNotes("");
                      }}
                      className="bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 font-bold text-xs px-3 py-1.5 rounded-xl border border-gray-200 transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Complete</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenSwapModal(item)}
                    className="p-1.5 hover:bg-indigo-50 rounded-lg text-charcoal/50 hover:text-indigo transition-colors"
                    title="Swap with another Saturday"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SATURDAY CHECKLIST */}
      {activeTab === "tasks" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 shadow-2xs">
            <h3 className="font-bold text-sm text-charcoal flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo" />
              <span>Standard Saturday Cleaning Checklist</span>
            </h3>
            <p className="text-xs text-charcoal/60">
              Assigned teams follow this standard protocol each Saturday before Sunday service:
            </p>
            <div className="space-y-2 text-xs">
              {[
                { task: "Sanctuary Sweeping & Mopping", desc: "Clean altar, aisles, pews, and pulpit area." },
                { task: "Restroom Sanitization", desc: "Restock toilet paper, soap, clean sinks and mirrors." },
                { task: "Trash Disposal & Replacement", desc: "Empty all indoor trash bins and replace liners." },
                { task: "Sound & Audio Visual Setup", desc: "Check microphones, sound console, projector screen." },
                { task: "Fellowship Area Preparation", desc: "Clean tables, wash coffee cups, wipe counters." },
                { task: "Entrance Porch & Perimeter", desc: "Sweep foyer entrance, ensure welcome mats are clean." },
              ].map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-ivory-light border border-gray-100 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-charcoal block">{item.task}</span>
                    <span className="text-[11px] text-charcoal/60">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 shadow-2xs">
            <h3 className="font-bold text-sm text-charcoal flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Duty Team Best Practices</span>
            </h3>
            <div className="space-y-3 text-xs text-charcoal/70">
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80">
                <span className="font-bold text-amber-950 block mb-1">⏰ Call Time & Attendance</span>
                <p className="text-[11px] text-amber-900">
                  Duty teams convene at the church premises every Saturday by 1:00 PM - 3:00 PM. Team Leaders coordinate attendance in advance.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80">
                <span className="font-bold text-indigo-950 block mb-1">🔄 Schedule Swaps</span>
                <p className="text-[11px] text-indigo-900">
                  If team members have personal conflicts on their designated Saturday, use the <strong>"Swap Saturday Team"</strong> button to trade dates with another team.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <span className="font-bold text-emerald-950 block mb-1">✨ Verification & Sunday Readiness</span>
                <p className="text-[11px] text-emerald-900">
                  Once all areas are verified clean and sound checks complete, click <strong>"Mark Duty Completed"</strong> on the dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Create / Edit Duty Team */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo" />
                <span>{editingTeam ? "Edit Duty Team" : "Create New Duty Team"}</span>
              </h2>
              <button onClick={() => setIsTeamModalOpen(false)} className="p-1 text-charcoal/50 hover:text-charcoal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">Team Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Team 1, Team 2"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                </div>
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">Rotation Order (Seq)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={teamForm.order_seq}
                    onChange={(e) => setTeamForm({ ...teamForm, order_seq: Number(e.target.value) })}
                    className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Assigned Team Leader</label>
                <select
                  value={teamForm.leader_id}
                  onChange={(e) => setTeamForm({ ...teamForm, leader_id: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                >
                  <option value="">Select Leader (or assign later)</option>
                  {churchMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.ministry_name || "Member"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Team Color Tag</label>
                <div className="flex items-center gap-2">
                  {["#2C3968", "#E07A5F", "#6E8B74", "#D9A441", "#8D5B4C", "#4A5568"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTeamForm({ ...teamForm, color: c })}
                      className={`w-7 h-7 rounded-full transition-all ${
                        teamForm.color === c ? "ring-3 ring-indigo-400 scale-110 shadow-sm" : "opacity-80"
                      }`}
                      style={{ backgroundColor: c }}
                    ></button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Duty Tasks / Checklist</label>
                <textarea
                  rows={3}
                  value={teamForm.tasks_checklist}
                  onChange={(e) => setTeamForm({ ...teamForm, tasks_checklist: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  placeholder="e.g. Sanctuary Cleaning, Sound Setup, Trash Disposal..."
                ></textarea>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md"
                >
                  {editingTeam ? "Save Changes" : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Member to Team */}
      {isAddMemberModalOpen && targetTeam && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-charcoal">Add Member to {targetTeam.name}</h2>
                <span className="text-[10px] text-charcoal/50">Assign disciples to this Saturday duty rotation</span>
              </div>
              <button onClick={() => setIsAddMemberModalOpen(false)} className="p-1 text-charcoal/50 hover:text-charcoal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMemberToTeam} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Search & Select Disciple *</label>
                <input
                  type="text"
                  placeholder="Filter disciples by name..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full mb-2 bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
                />
                <select
                  required
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  size={5}
                >
                  {churchMembers
                    .filter(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({m.ministry_name || "General"})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Role in Team</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as any)}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                >
                  <option value="Member">Regular Team Member</option>
                  <option value="Team Leader">Team Leader</option>
                </select>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Swap Saturday Duty */}
      {isSwapModalOpen && swapItem1 && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-indigo" />
                <span>Swap Saturday Duty Teams</span>
              </h2>
              <button onClick={() => setIsSwapModalOpen(false)} className="p-1 text-charcoal/50 hover:text-charcoal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteSwap} className="space-y-4 text-xs">
              <div className="bg-ivory-light p-3 rounded-xl border border-gray-200">
                <span className="text-[10px] text-charcoal/50 block font-bold">Current Assignment</span>
                <span className="text-xs font-bold text-charcoal">{swapItem1.date_formatted}</span>
                <div className="text-indigo font-black mt-0.5">{swapItem1.team?.name}</div>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Swap With Another Saturday *</label>
                <select
                  required
                  value={swapTargetDate}
                  onChange={(e) => setSwapTargetDate(e.target.value)}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                >
                  {schedule
                    .filter(s => s.duty_date !== swapItem1.duty_date && s.team)
                    .map((s) => (
                      <option key={s.duty_date} value={s.duty_date}>
                        {s.date_formatted} — {s.team?.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSwapModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md flex items-center gap-1.5"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Execute Swap</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Mark Duty Complete */}
      {completingItem && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Verify Saturday Duty Completion</span>
              </h2>
              <button onClick={() => setCompletingItem(null)} className="p-1 text-charcoal/50 hover:text-charcoal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteDuty} className="space-y-4 text-xs">
              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-900 block font-bold">Duty Record</span>
                <span className="text-xs font-black text-emerald-950">{completingItem.date_formatted}</span>
                <div className="text-emerald-800 font-bold mt-0.5">{completingItem.team?.name}</div>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Completion Notes / Inspection Remarks</label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. All areas sanitized, sound tested, garbage disposed."
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompletingItem(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Duty Completed</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

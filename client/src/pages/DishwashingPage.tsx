import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { DishwashingDutyItem, DishwashingResponse } from "../types";
import { 
  Sparkles, Calendar, Users, CheckCircle2, 
  RotateCw, Plus, ArrowRight, Clock, 
  ArrowLeftRight, Trash2, CalendarCheck, Utensils, 
  Check, Edit, X, Building2, BookOpen, UserCheck, Handshake, Users2
} from "lucide-react";

interface FormTeamItem {
  id: string;
  cycle_mode: "biblestudy_group" | "ministry";
  biblestudy_group_id: string;
  ministry_id: string;
  assigned_name: string;
  leader_name: string;
}

export const DishwashingPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrCoordinator = user?.role_name === "Admin" || user?.role_name === "Coordinator";

  const [duties, setDuties] = useState<DishwashingDutyItem[]>([]);
  const [thisSunday, setThisSunday] = useState<DishwashingDutyItem | null>(null);
  const [nextSunday, setNextSunday] = useState<DishwashingDutyItem | null>(null);
  const [cycleOptions, setCycleOptions] = useState<DishwashingResponse["cycleOptions"]>({ groups: [], ministries: [] });
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [isDutyModalOpen, setIsDutyModalOpen] = useState(false);
  const [editingDutyId, setEditingDutyId] = useState<number | null>(null);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [selectedDutyForSwap, setSelectedDutyForSwap] = useState<DishwashingDutyItem | null>(null);
  const [targetDutyId, setTargetDutyId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);

  // Auto Cycle Generator Form
  const [cycleForm, setCycleForm] = useState({
    cycle_mode: "biblestudy_group" as "biblestudy_group" | "ministry",
    start_date: "2026-08-30",
    weeks_count: 8,
    replace_existing: true,
    teams_per_turn: 1 as 1 | 2
  });

  // Dynamic Teams List inside Add/Edit Modal
  const [dutyDate, setDutyDate] = useState("2026-08-30");
  const [dutyStatus, setDutyStatus] = useState<"scheduled" | "completed" | "swapped">("scheduled");
  const [dutyNotes, setDutyNotes] = useState("");
  const [formTeams, setFormTeams] = useState<FormTeamItem[]>([]);

  useEffect(() => {
    loadDuties();
  }, [filterStatus, filterMode]);

  const loadDuties = async () => {
    try {
      setLoading(true);
      const res = await api.getDishwashingDuties({
        status: filterStatus !== "all" ? filterStatus : undefined,
        cycle_mode: filterMode !== "all" ? filterMode : undefined
      });
      setDuties(res.duties || []);
      setThisSunday(res.thisSunday || null);
      setNextSunday(res.nextSunday || null);
      setCycleOptions(res.cycleOptions || { groups: [], ministries: [] });
    } catch (err) {
      console.error("Failed to load dishwashing duties:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await api.generateDishwashingCycle(cycleForm);
      alert(res.message || "Cycle generated successfully!");
      setIsCycleModalOpen(false);
      loadDuties();
    } catch (err: any) {
      alert(err.message || "Failed to generate cycle");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingDutyId(null);
    setDutyDate("2026-08-30");
    setDutyStatus("scheduled");
    setDutyNotes("");

    const firstGroup = cycleOptions.groups[0];
    setFormTeams([
      {
        id: "team-1",
        cycle_mode: "biblestudy_group",
        biblestudy_group_id: firstGroup?.id ? String(firstGroup.id) : "",
        ministry_id: "",
        assigned_name: firstGroup?.name || "",
        leader_name: firstGroup?.leader_name || ""
      }
    ]);
    setIsDutyModalOpen(true);
  };

  const handleOpenEditModal = (duty: DishwashingDutyItem) => {
    setEditingDutyId(duty.id);
    setDutyDate(duty.duty_date ? duty.duty_date.split("T")[0] : "2026-08-30");
    setDutyStatus(duty.status || "scheduled");
    setDutyNotes(duty.notes || "");

    const initialTeams: FormTeamItem[] = [];

    // Team 1
    const firstGroup = duty.biblestudy_group_id 
      ? cycleOptions.groups.find(g => g.id === duty.biblestudy_group_id)
      : null;
    const firstMin = duty.ministry_id 
      ? cycleOptions.ministries.find(m => m.id === duty.ministry_id)
      : null;

    initialTeams.push({
      id: "team-1",
      cycle_mode: duty.cycle_mode || (firstGroup ? "biblestudy_group" : "ministry"),
      biblestudy_group_id: duty.biblestudy_group_id ? String(duty.biblestudy_group_id) : (firstGroup ? String(firstGroup.id) : ""),
      ministry_id: duty.ministry_id ? String(duty.ministry_id) : (firstMin ? String(firstMin.id) : ""),
      assigned_name: duty.assigned_name || (firstGroup?.name || firstMin?.name || ""),
      leader_name: duty.leader_name || (firstGroup?.leader_name || firstMin?.coordinator_name || "")
    });

    // Partner / Team 2+
    if (duty.partner_assigned_name) {
      const pNames = duty.partner_assigned_name.split(" & ");
      const pLeaders = (duty.partner_leader_name || "").split(" & ");

      pNames.forEach((name, idx) => {
        const pGrp = cycleOptions.groups.find(g => g.name === name);
        const pMin = cycleOptions.ministries.find(m => `${m.name} Ministry` === name || m.name === name);

        initialTeams.push({
          id: `team-partner-${idx + 1}`,
          cycle_mode: pMin ? "ministry" : "biblestudy_group",
          biblestudy_group_id: pGrp ? String(pGrp.id) : (duty.partner_biblestudy_group_id ? String(duty.partner_biblestudy_group_id) : ""),
          ministry_id: pMin ? String(pMin.id) : (duty.partner_ministry_id ? String(duty.partner_ministry_id) : ""),
          assigned_name: name,
          leader_name: pLeaders[idx] || (pGrp?.leader_name || pMin?.coordinator_name || "")
        });
      });
    }

    setFormTeams(initialTeams);
    setIsDutyModalOpen(true);
  };

  const handleAddAnotherTeam = () => {
    const nextIdx = formTeams.length;
    const nextGroup = cycleOptions.groups[nextIdx % cycleOptions.groups.length] || cycleOptions.groups[0];
    
    setFormTeams(prev => [
      ...prev,
      {
        id: `team-${Date.now()}-${Math.random()}`,
        cycle_mode: "biblestudy_group",
        biblestudy_group_id: nextGroup?.id ? String(nextGroup.id) : "",
        ministry_id: "",
        assigned_name: nextGroup?.name || "",
        leader_name: nextGroup?.leader_name || ""
      }
    ]);
  };

  const handleRemoveTeam = (indexToRemove: number) => {
    if (formTeams.length <= 1) return;
    setFormTeams(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdateTeamMode = (index: number, mode: "biblestudy_group" | "ministry") => {
    setFormTeams(prev => {
      const updated = [...prev];
      if (mode === "biblestudy_group") {
        const grp = cycleOptions.groups[0];
        updated[index] = {
          ...updated[index],
          cycle_mode: "biblestudy_group",
          biblestudy_group_id: grp?.id ? String(grp.id) : "",
          ministry_id: "",
          assigned_name: grp?.name || "",
          leader_name: grp?.leader_name || ""
        };
      } else {
        const min = cycleOptions.ministries[0];
        updated[index] = {
          ...updated[index],
          cycle_mode: "ministry",
          biblestudy_group_id: "",
          ministry_id: min?.id ? String(min.id) : "",
          assigned_name: min ? `${min.name} Ministry` : "",
          leader_name: min?.coordinator_name || "Ministry Coordinator"
        };
      }
      return updated;
    });
  };

  const handleUpdateTeamSelection = (index: number, selectedId: string) => {
    setFormTeams(prev => {
      const updated = [...prev];
      const team = updated[index];
      if (team.cycle_mode === "biblestudy_group") {
        const grp = cycleOptions.groups.find(g => String(g.id) === selectedId);
        updated[index] = {
          ...team,
          biblestudy_group_id: selectedId,
          assigned_name: grp?.name || "",
          leader_name: grp?.leader_name || ""
        };
      } else {
        const min = cycleOptions.ministries.find(m => String(m.id) === selectedId);
        updated[index] = {
          ...team,
          ministry_id: selectedId,
          assigned_name: min ? `${min.name} Ministry` : "",
          leader_name: min?.coordinator_name || "Ministry Coordinator"
        };
      }
      return updated;
    });
  };

  const handleUpdateTeamLeader = (index: number, leaderName: string) => {
    setFormTeams(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], leader_name: leaderName };
      return updated;
    });
  };

  const handleSaveDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formTeams.length === 0) return;

    try {
      setActionLoading(true);

      const team1 = formTeams[0];
      const partnerTeams = formTeams.slice(1);
      const isJoint = partnerTeams.length > 0;

      const partnerAssignedName = isJoint 
        ? partnerTeams.map(t => t.assigned_name).filter(Boolean).join(" & ") 
        : null;
      const partnerLeaderName = isJoint 
        ? partnerTeams.map(t => t.leader_name).filter(Boolean).join(" & ") 
        : null;

      const payload = {
        duty_date: dutyDate,
        cycle_mode: team1.cycle_mode,
        assigned_name: team1.assigned_name,
        leader_name: team1.leader_name,
        partner_assigned_name: partnerAssignedName,
        partner_leader_name: partnerLeaderName,
        partner_biblestudy_group_id: partnerTeams[0]?.cycle_mode === "biblestudy_group" && partnerTeams[0].biblestudy_group_id ? Number(partnerTeams[0].biblestudy_group_id) : null,
        partner_ministry_id: partnerTeams[0]?.cycle_mode === "ministry" && partnerTeams[0].ministry_id ? Number(partnerTeams[0].ministry_id) : null,
        is_joint_duty: isJoint,
        status: dutyStatus,
        volunteers_count: isJoint ? Math.max(6, formTeams.length * 3) : 4,
        notes: dutyNotes,
        biblestudy_group_id: team1.cycle_mode === "biblestudy_group" && team1.biblestudy_group_id ? Number(team1.biblestudy_group_id) : null,
        ministry_id: team1.cycle_mode === "ministry" && team1.ministry_id ? Number(team1.ministry_id) : null
      };

      if (editingDutyId) {
        await api.updateDishwashingDuty(editingDutyId, payload);
      } else {
        await api.createDishwashingDuty(payload);
      }

      setIsDutyModalOpen(false);
      loadDuties();
    } catch (err: any) {
      alert(err.message || "Failed to save dishwashing duty");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleComplete = async (duty: DishwashingDutyItem) => {
    try {
      const nextStatus = duty.status === "completed" ? "scheduled" : "completed";
      await api.updateDishwashingDuty(duty.id, {
        status: nextStatus,
        notes: nextStatus === "completed" ? `Completed on ${new Date().toLocaleDateString()}` : ""
      });
      loadDuties();
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleOpenSwap = (duty: DishwashingDutyItem) => {
    setSelectedDutyForSwap(duty);
    setTargetDutyId("");
    setIsSwapModalOpen(true);
  };

  const handleExecuteSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDutyForSwap || !targetDutyId) return;

    try {
      setActionLoading(true);
      await api.swapDishwashingDuty(selectedDutyForSwap.id, Number(targetDutyId));
      setIsSwapModalOpen(false);
      loadDuties();
    } catch (err: any) {
      alert(err.message || "Failed to swap duty turns");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to remove this duty date from the schedule?")) return;
    try {
      await api.deleteDishwashingDuty(id);
      loadDuties();
    } catch (err: any) {
      alert(err.message || "Failed to delete duty");
    }
  };

  // Filter list by search query
  const filteredDuties = duties.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.assigned_name.toLowerCase().includes(q) ||
      (d.partner_assigned_name && d.partner_assigned_name.toLowerCase().includes(q)) ||
      (d.leader_name && d.leader_name.toLowerCase().includes(q)) ||
      (d.partner_leader_name && d.partner_leader_name.toLowerCase().includes(q)) ||
      d.duty_date.includes(q) ||
      (d.notes && d.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      
      {/* PAGE HEADER & PRIMARY CRUD ACTIONS */}
      <div className="relative overflow-hidden bg-white/95 rounded-3xl p-6 sm:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-4 ring-amber-100/50">
              <Utensils className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-charcoal tracking-tight">
              Dishwashing & Kitchen Roster
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-900 border border-indigo-200/80 flex items-center gap-1.5 shadow-2xs">
              <Handshake className="w-3.5 h-3.5 text-amber-500" />
              <span>Multi-Team Rotation</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed">
            Coordinate post-fellowship meal dishwashing and kitchen cleanup with automated leader autofills, joint team-ups, and round-robin cycle tracking.
          </p>
        </div>

        {isAdminOrCoordinator && (
          <div className="relative z-10 flex items-center gap-3 flex-wrap shrink-0">
            <button
              onClick={() => setIsCycleModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-indigo-50/60 text-charcoal text-xs font-bold border border-indigo-200/80 transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
            >
              <RotateCw className="w-4 h-4 text-indigo" />
              <span>Auto-Cycle Generator</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-950" />
              <span>+ Schedule Duty</span>
            </button>
          </div>
        )}
      </div>

      {/* TOP DUAL ALERT CARDS: THIS SUNDAY'S DUTY + NEXT ON DECK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* CARD 1: THIS SUNDAY'S DISHWASHING IN-CHARGE (PRIMARY ALERT) */}
        <div className="lg:col-span-7 bg-gradient-to-br from-[#1b2342] via-[#243058] to-[#1b2342] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-white/10 flex flex-col justify-between">
          
          {/* Decorative Background Accents */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-amber-400/15 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none -ml-16 -mb-16"></div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[11px] font-black tracking-wider uppercase shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>THIS SUNDAY'S DISHWASHING IN-CHARGE</span>
              </div>

              {thisSunday && (
                <div className="flex items-center gap-2">
                  {thisSunday.partner_assigned_name && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-indigo-950 flex items-center gap-1 shadow-2xs">
                      <Handshake className="w-3 h-3" />
                      <span>Joint Duty</span>
                    </span>
                  )}
                  <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase border ${
                    thisSunday.status === "completed" 
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40" 
                      : "bg-amber-500/20 text-amber-300 border-amber-400/40 animate-pulse"
                  }`}>
                    {thisSunday.status === "completed" ? "✓ Completed" : "⏳ Active On Duty"}
                  </span>
                </div>
              )}
            </div>

            {thisSunday ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
                    <span>{thisSunday.assigned_name}</span>
                    {thisSunday.partner_assigned_name && (
                      <>
                        <span className="text-amber-400 font-bold">&</span>
                        <span>{thisSunday.partner_assigned_name}</span>
                      </>
                    )}
                  </h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white/10 text-indigo-100 border border-white/10">
                    {thisSunday.cycle_mode === "biblestudy_group" ? "📖 Bible Study Group" : "🏛️ Ministry Department"}
                  </span>
                  {thisSunday.partner_assigned_name && (
                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30 flex items-center gap-1">
                      <Users2 className="w-3.5 h-3.5" />
                      <span>Teamed Up Pair</span>
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed max-w-xl">
                  Assigned turn for post-worship fellowship lunch kitchen cleaning and ware sanitation.
                </p>
              </div>
            ) : (
              <div className="py-6 text-center text-indigo-200/80 text-sm">
                No upcoming dishwashing duty scheduled. Click <strong>"+ Schedule Duty"</strong> or <strong>"Auto-Cycle Generator"</strong> to add one!
              </div>
            )}
          </div>

          {/* Bottom Info Bar for This Sunday */}
          {thisSunday && (
            <div className="relative z-10 mt-6 pt-5 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-indigo-100">
                <div className="flex items-center gap-1.5 font-bold bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                  <Calendar className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>{new Date(thisSunday.duty_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                {thisSunday.leader_name && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <UserCheck className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>In-Charge: <strong className="text-white font-bold">{thisSunday.leader_name}</strong> {thisSunday.partner_leader_name ? `& ${thisSunday.partner_leader_name}` : ''}</span>
                  </div>
                )}
              </div>

              {isAdminOrCoordinator && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(thisSunday)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer flex items-center gap-1.5 border border-white/10"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleToggleComplete(thisSunday)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                      thisSunday.status === "completed"
                        ? "bg-white/20 text-white hover:bg-white/30"
                        : "bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{thisSunday.status === "completed" ? "Mark Incomplete" : "Mark as Completed"}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CARD 2: NEXT ON DECK (ADVANCE ALERT) */}
        <div className="lg:col-span-5 bg-white/95 rounded-3xl p-6 sm:p-7 border border-indigo-100/90 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-black uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>NEXT SUNDAY IN ROTATION</span>
              </div>
              <span className="text-[11px] font-bold text-charcoal/50">Next Turn</span>
            </div>

            {nextSunday ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h3 className="text-xl font-black text-charcoal">
                    {nextSunday.assigned_name}
                    {nextSunday.partner_assigned_name && (
                      <span className="text-indigo ml-1.5 font-bold">& {nextSunday.partner_assigned_name}</span>
                    )}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-gray-100 text-charcoal/70 font-black">
                    {nextSunday.cycle_mode === "biblestudy_group" ? "Bible Study Group" : "Ministry"}
                  </span>
                  {nextSunday.partner_assigned_name && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black flex items-center gap-1">
                      <Handshake className="w-3 h-3" />
                      <span>Joint Team-Up</span>
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-charcoal/70 leading-relaxed">
                  Scheduled for next Sunday fellowship meal. Please give advance notice to assigned teams and coordinators.
                </p>

                <div className="bg-ivory-light/90 p-4 rounded-2xl border border-indigo-100/70 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-charcoal/80 font-medium">
                    <span className="text-charcoal/60">Date:</span>
                    <strong className="text-indigo font-black">
                      {new Date(nextSunday.duty_date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </strong>
                  </div>
                  {nextSunday.leader_name && (
                    <div className="flex items-center justify-between text-charcoal/80 font-medium">
                      <span className="text-charcoal/60">In-Charge / Leaders:</span>
                      <strong className="text-charcoal font-bold">{nextSunday.leader_name} {nextSunday.partner_leader_name ? `& ${nextSunday.partner_leader_name}` : ''}</strong>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-charcoal/40 text-xs">
                No next group scheduled in cycle.
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-charcoal/60">
            <span className="font-medium">Continuous cycle active</span>
            {isAdminOrCoordinator && nextSunday && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleOpenEditModal(nextSunday)}
                  className="text-xs font-bold text-charcoal/70 hover:text-indigo flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleOpenSwap(nextSunday)}
                  className="text-xs font-black text-indigo hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-colors bg-indigo-50 px-2.5 py-1 rounded-xl"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Swap Turn</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ACTIVE CYCLE ORDER VISUALIZER */}
      <div className="bg-white/95 p-6 rounded-3xl border border-indigo-100/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <RotateCw className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-black text-charcoal tracking-tight">
                Active Round-Robin Cycle Sequence
              </h3>
              <p className="text-[11px] text-charcoal/60">Continuous Sunday loop distribution across groups & ministries</p>
            </div>
          </div>
          <span className="text-xs font-black text-indigo-900 bg-indigo-50 border border-indigo-200/80 px-3 py-1 rounded-full shadow-2xs">
            {duties.length} Total Assigned Sundays
          </span>
        </div>

        {/* Horizontal Visual Cycle Steps */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar">
          {duties.slice(0, 8).map((item, idx) => {
            const isThis = thisSunday?.id === item.id;
            const isNext = nextSunday?.id === item.id;
            const isDone = item.status === "completed";

            return (
              <React.Fragment key={item.id}>
                <div className={`shrink-0 p-4 rounded-2xl border transition-all text-xs space-y-2 min-w-[200px] shadow-2xs hover:shadow-xs ${
                  isThis 
                    ? "bg-gradient-to-br from-[#1b2342] to-[#243058] text-white border-indigo-700 shadow-md scale-102 ring-2 ring-amber-400/40" 
                    : isNext
                    ? "bg-amber-50/70 border-amber-200/90 text-charcoal"
                    : isDone
                    ? "bg-emerald-50/40 border-emerald-200/60 text-charcoal/80"
                    : "bg-white border-indigo-100/80 text-charcoal"
                }`}>
                  <div className="flex items-center justify-between text-[10px] font-black">
                    <span className={isThis ? "text-amber-300" : "text-charcoal/60"}>
                      Turn #{item.cycle_order_index || idx + 1}
                    </span>
                    {isThis && <span className="bg-amber-400 text-indigo-950 px-2 py-0.5 rounded-full font-black shadow-2xs">THIS SUN</span>}
                    {isNext && <span className="bg-indigo-900 text-white px-2 py-0.5 rounded-full font-black">NEXT</span>}
                    {isDone && <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-black">✓ DONE</span>}
                  </div>
                  <h4 className={`font-black text-sm truncate ${isThis ? "text-white" : "text-charcoal"}`}>
                    {item.assigned_name}
                    {item.partner_assigned_name && ` & ${item.partner_assigned_name}`}
                  </h4>
                  <p className={`text-[11px] font-medium truncate ${isThis ? "text-indigo-200" : "text-charcoal/60"}`}>
                    {new Date(item.duty_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>

                {idx < Math.min(duties.length - 1, 7) && (
                  <ArrowRight className="w-4 h-4 text-indigo-300/80 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
          {duties.length > 8 && (
            <div className="shrink-0 text-xs font-black text-indigo-900 px-4 py-3 bg-indigo-50 border border-indigo-200/80 rounded-2xl">
              +{duties.length - 8} more turns
            </div>
          )}
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white/95 p-4 sm:p-5 rounded-3xl border border-indigo-100/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status filter */}
          <div className="flex items-center gap-2 text-xs font-bold text-charcoal/70">
            <span>Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-ivory-light px-3.5 py-2 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-bold text-indigo-900 cursor-pointer text-xs shadow-2xs"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">⏳ Scheduled Only</option>
              <option value="completed">✓ Completed Only</option>
              <option value="swapped">🔁 Swapped Turns</option>
            </select>
          </div>

          {/* Mode filter */}
          <div className="flex items-center gap-2 text-xs font-bold text-charcoal/70">
            <span>Assignment Type:</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="bg-ivory-light px-3.5 py-2 rounded-2xl border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-bold text-indigo-900 cursor-pointer text-xs shadow-2xs"
            >
              <option value="all">All Types (Ministries & Groups)</option>
              <option value="biblestudy_group">Bible Study Groups</option>
              <option value="ministry">Ministries</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Search group, ministry, leader, date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-ivory-light px-4 py-2 rounded-2xl text-xs border border-indigo-100/90 focus:outline-none focus:ring-2 focus:ring-indigo/20 font-medium placeholder:text-charcoal/40"
          />
        </div>
      </div>

      {/* DUTIES SCHEDULE TABLE */}
      <div className="bg-white/95 rounded-3xl border border-indigo-100/90 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-indigo-100/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-black text-charcoal text-sm">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <CalendarCheck className="w-4 h-4" />
            </span>
            <span>Full Dishwashing Schedule & Roster</span>
            <span className="text-xs text-charcoal/50 font-normal">({filteredDuties.length} dates listed)</span>
          </div>

          {isAdminOrCoordinator && (
            <button
              onClick={handleOpenAddModal}
              className="text-xs font-black text-indigo hover:text-indigo-700 flex items-center gap-1 cursor-pointer bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule New Date</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-16 text-center text-charcoal/40 text-xs font-medium">
            Loading dishwashing schedule...
          </div>
        ) : filteredDuties.length === 0 ? (
          <div className="p-16 text-center text-charcoal/50 text-xs space-y-3">
            <p className="font-bold text-charcoal/70">No dishwashing duties scheduled yet.</p>
            {isAdminOrCoordinator && (
              <button
                onClick={handleOpenAddModal}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs rounded-2xl shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Duty Date</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-indigo-50/40 text-charcoal/80 font-black border-b border-indigo-100/80 text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-5">Sunday Date</th>
                  <th className="py-3.5 px-5">Assigned Entity (Teamed Up Groups/Ministries)</th>
                  <th className="py-3.5 px-5">Assignment Type</th>
                  <th className="py-3.5 px-5">In-Charge / Leaders</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50 font-medium">
                {filteredDuties.map((d) => {
                  const isThis = thisSunday?.id === d.id;
                  const isCompleted = d.status === "completed";
                  const isJoint = Boolean(d.is_joint_duty || d.partner_assigned_name);

                  return (
                    <tr 
                      key={d.id} 
                      className={`hover:bg-indigo-50/30 transition-colors ${
                        isThis ? "bg-amber-50/60 font-semibold" : ""
                      }`}
                    >
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-charcoal">
                            {new Date(d.duty_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          {isThis && (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-indigo-950 shadow-2xs">
                              THIS SUN
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="space-y-1">
                          <div className="font-black text-charcoal flex items-center gap-2 flex-wrap">
                            <span>{d.assigned_name}</span>
                            {d.partner_assigned_name && (
                              <>
                                <span className="text-amber-500 font-black">&</span>
                                <span className="text-indigo-900">{d.partner_assigned_name}</span>
                              </>
                            )}
                          </div>
                          {isJoint && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-950 border border-amber-300">
                              <Handshake className="w-3 h-3 text-amber-700" />
                              <span>Teamed Up (Joint Duty)</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-gray-100 text-charcoal/80 uppercase">
                          {d.cycle_mode === "biblestudy_group" ? "Bible Study Group" : "Ministry Department"}
                        </span>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="text-xs">
                          <span className="font-bold text-charcoal">
                            {d.leader_name || "Unassigned"}
                            {d.partner_leader_name ? ` & ${d.partner_leader_name}` : ''}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1.5 ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-950 border border-emerald-300 font-black"
                            : d.status === "swapped"
                            ? "bg-blue-100 text-blue-900 border border-blue-200"
                            : "bg-amber-100 text-amber-950 border border-amber-300 font-black"
                        }`}>
                          {isCompleted ? <Check className="w-3 h-3 text-emerald-700" /> : <Clock className="w-3 h-3 text-amber-700" />}
                          <span>{d.status}</span>
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isAdminOrCoordinator && (
                            <>
                              <button
                                onClick={() => handleToggleComplete(d)}
                                title={isCompleted ? "Mark Incomplete" : "Mark Completed"}
                                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                                  isCompleted
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-ivory-light text-charcoal/70 border-indigo-100 hover:bg-indigo-50/60"
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleOpenEditModal(d)}
                                title="Edit Duty Details"
                                className="p-2 rounded-xl bg-ivory-light text-indigo hover:bg-indigo-50 border border-indigo-100 transition-all cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleOpenSwap(d)}
                                title="Swap Turn with another date"
                                className="p-2 rounded-xl bg-ivory-light text-amber-600 hover:bg-amber-50 border border-indigo-100 transition-all cursor-pointer"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDelete(d.id)}
                                title="Delete duty"
                                className="p-2 rounded-xl bg-ivory-light text-rose hover:bg-rose-50 border border-indigo-100 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CRUD MODAL: ADD / EDIT DISHWASHING DUTY WITH DYNAMIC (+) TEAM-UP BUTTON */}
      {isDutyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo text-white">
                  <Utensils className="w-4 h-4 text-amber-300" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-charcoal">
                    {editingDutyId ? "Edit Dishwashing Duty" : "Schedule Dishwashing Duty"}
                  </h3>
                  <p className="text-xs text-charcoal/60">
                    Assign one group or click <strong>"+ Add Team"</strong> to team up as many groups as you want!
                  </p>
                </div>
              </div>
              <button onClick={() => setIsDutyModalOpen(false)} className="p-1 text-charcoal/40 hover:text-charcoal cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDuty} className="space-y-4 text-xs">
              
              {/* DYNAMIC LIST OF ASSIGNED TEAMS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-charcoal text-xs flex items-center gap-1.5">
                    <Users2 className="w-4 h-4 text-indigo" />
                    <span>Assigned Teams & In-Charge ({formTeams.length} {formTeams.length === 1 ? 'Team' : 'Teams Teamed Up'})</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleAddAnotherTeam}
                    className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs hover:shadow-xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Team</span>
                  </button>
                </div>

                {formTeams.map((team, idx) => {
                  const isPrimary = idx === 0;

                  return (
                    <div 
                      key={team.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isPrimary 
                          ? "bg-ivory-light/80 border-gray-200" 
                          : "bg-amber-50/50 border-amber-200/80 animate-fade-in"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                            isPrimary ? "bg-indigo text-white" : "bg-amber-400 text-indigo-950"
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-charcoal">
                            {isPrimary ? "Primary Team / Group" : `Teamed-Up Partner Team #${idx + 1}`}
                          </span>
                        </div>

                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTeam(idx)}
                            className="text-charcoal/40 hover:text-rose p-1 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors flex items-center gap-1 text-[11px] font-semibold"
                            title="Remove this teamed-up team"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      {/* SEGMENTED SWITCH: BIBLE STUDY GROUP VS MINISTRY */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateTeamMode(idx, "biblestudy_group")}
                          className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer flex items-center gap-2 ${
                            team.cycle_mode === "biblestudy_group"
                              ? "bg-indigo text-white border-indigo shadow-xs"
                              : "bg-white text-charcoal/70 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <BookOpen className={`w-3.5 h-3.5 shrink-0 ${team.cycle_mode === "biblestudy_group" ? "text-amber-300" : "text-indigo"}`} />
                          <span>Bible Study Group</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateTeamMode(idx, "ministry")}
                          className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer flex items-center gap-2 ${
                            team.cycle_mode === "ministry"
                              ? "bg-indigo text-white border-indigo shadow-xs"
                              : "bg-white text-charcoal/70 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <Building2 className={`w-3.5 h-3.5 shrink-0 ${team.cycle_mode === "ministry" ? "text-amber-300" : "text-indigo"}`} />
                          <span>Ministry Department</span>
                        </button>
                      </div>

                      {/* SELECTION DROPDOWN */}
                      {team.cycle_mode === "biblestudy_group" ? (
                        <div>
                          <label className="block font-bold text-charcoal mb-1">Select Bible Study Group *</label>
                          <select
                            required
                            value={team.biblestudy_group_id}
                            onChange={(e) => handleUpdateTeamSelection(idx, e.target.value)}
                            className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo cursor-pointer"
                          >
                            <option value="">-- Choose Bible Study Group --</option>
                            {cycleOptions.groups.map(g => (
                              <option key={g.id} value={g.id}>
                                {g.name} (Leader: {g.leader_name || "Unassigned"})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block font-bold text-charcoal mb-1">Select Ministry Department *</label>
                          <select
                            required
                            value={team.ministry_id}
                            onChange={(e) => handleUpdateTeamSelection(idx, e.target.value)}
                            className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo cursor-pointer"
                          >
                            <option value="">-- Choose Ministry --</option>
                            {cycleOptions.ministries.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} Ministry {m.coordinator_name ? `(Coord: ${m.coordinator_name})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block font-bold text-charcoal mb-0.5">
                          {team.cycle_mode === "biblestudy_group" ? "Team Leader" : "Ministry Coordinator"} <span className="text-[10px] text-indigo font-normal">(Auto-filled)</span>
                        </label>
                        <input
                          type="text"
                          value={team.leader_name}
                          onChange={(e) => handleUpdateTeamLeader(idx, e.target.value)}
                          className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-charcoal"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* PROMINENT + ADD TEAM BUTTON */}
                <button
                  type="button"
                  onClick={handleAddAnotherTeam}
                  className="w-full py-3 px-4 border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50/80 rounded-2xl text-amber-900 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  <Plus className="w-4 h-4 text-amber-600" />
                  <span>+ Team Up Another Bible Group or Ministry</span>
                </button>
              </div>

              {/* DATE & STATUS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-bold text-charcoal mb-1">Duty Date (Sunday) *</label>
                  <input
                    type="date"
                    required
                    value={dutyDate}
                    onChange={(e) => setDutyDate(e.target.value)}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo"
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal mb-1">Status</label>
                  <select
                    value={dutyStatus}
                    onChange={(e) => setDutyStatus(e.target.value as any)}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-semibold text-charcoal"
                  >
                    <option value="scheduled">⏳ Scheduled</option>
                    <option value="completed">✓ Completed</option>
                    <option value="swapped">🔁 Swapped</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Notes / Remarks (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Joint fellowship lunch cleaning after anniversary service..."
                  value={dutyNotes}
                  onChange={(e) => setDutyNotes(e.target.value)}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDutyModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Saving..." : (editingDutyId ? "Save Changes" : "Schedule Duty")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AUTO-CYCLE GENERATOR */}
      {isCycleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 space-y-5 animate-scale-up">
            
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo text-white">
                  <RotateCw className="w-4 h-4 animate-spin-slow" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-charcoal">Generate Round-Robin Cycle</h3>
                  <p className="text-xs text-charcoal/60">Automate upcoming Sunday dishwashing turns in continuous loop</p>
                </div>
              </div>
              <button onClick={() => setIsCycleModalOpen(false)} className="p-1 text-charcoal/40 hover:text-charcoal cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateCycle} className="space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-charcoal mb-1">Rotation Mode *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCycleForm({ ...cycleForm, cycle_mode: "biblestudy_group" })}
                    className={`p-3 rounded-2xl border text-left font-bold transition-all cursor-pointer ${
                      cycleForm.cycle_mode === "biblestudy_group"
                        ? "bg-indigo text-white border-indigo shadow-sm"
                        : "bg-ivory-light text-charcoal/70 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span>By Bible Study Group</span>
                    <span className={`block text-[10px] font-normal mt-0.5 ${cycleForm.cycle_mode === "biblestudy_group" ? "text-indigo-200" : "text-charcoal/50"}`}>
                      Auto-fills respective group leaders
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCycleForm({ ...cycleForm, cycle_mode: "ministry" })}
                    className={`p-3 rounded-2xl border text-left font-bold transition-all cursor-pointer ${
                      cycleForm.cycle_mode === "ministry"
                        ? "bg-indigo text-white border-indigo shadow-sm"
                        : "bg-ivory-light text-charcoal/70 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span>By Ministry Department</span>
                    <span className={`block text-[10px] font-normal mt-0.5 ${cycleForm.cycle_mode === "ministry" ? "text-indigo-200" : "text-charcoal/50"}`}>
                      Auto-fills respective coordinators
                    </span>
                  </button>
                </div>
              </div>

              {/* TEAM-UP STRUCTURE */}
              <div>
                <label className="block font-bold text-charcoal mb-1">Teams Assigned per Sunday *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCycleForm({ ...cycleForm, teams_per_turn: 1 })}
                    className={`p-3 rounded-2xl border text-left font-bold transition-all cursor-pointer ${
                      cycleForm.teams_per_turn === 1
                        ? "bg-indigo text-white border-indigo shadow-sm"
                        : "bg-ivory-light text-charcoal/70 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span>1 Team / Group Only</span>
                    <span className={`block text-[10px] font-normal mt-0.5 ${cycleForm.teams_per_turn === 1 ? "text-indigo-200" : "text-charcoal/50"}`}>
                      Standard single team rotation
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCycleForm({ ...cycleForm, teams_per_turn: 2 })}
                    className={`p-3 rounded-2xl border text-left font-bold transition-all cursor-pointer ${
                      cycleForm.teams_per_turn === 2
                        ? "bg-indigo text-white border-indigo shadow-sm"
                        : "bg-ivory-light text-charcoal/70 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Handshake className="w-3.5 h-3.5 text-amber-300" />
                      <span>2 Teams Teaming Up</span>
                    </span>
                    <span className={`block text-[10px] font-normal mt-0.5 ${cycleForm.teams_per_turn === 2 ? "text-indigo-200" : "text-charcoal/50"}`}>
                      Pairs 2 groups/ministries per Sunday
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-charcoal mb-1">Starting Sunday *</label>
                  <input
                    type="date"
                    required
                    value={cycleForm.start_date}
                    onChange={(e) => setCycleForm({ ...cycleForm, start_date: e.target.value })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo"
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal mb-1">Duration (Weeks) *</label>
                  <select
                    value={cycleForm.weeks_count}
                    onChange={(e) => setCycleForm({ ...cycleForm, weeks_count: Number(e.target.value) })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo cursor-pointer"
                  >
                    <option value={4}>4 Weeks (1 Month)</option>
                    <option value={8}>8 Weeks (2 Months)</option>
                    <option value={12}>12 Weeks (1 Quarter)</option>
                    <option value={24}>24 Weeks (Half Year)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="replaceFuture"
                  checked={cycleForm.replace_existing}
                  onChange={(e) => setCycleForm({ ...cycleForm, replace_existing: e.target.checked })}
                  className="rounded text-indigo cursor-pointer"
                />
                <label htmlFor="replaceFuture" className="font-medium text-charcoal/80 cursor-pointer">
                  Replace any scheduled future turns starting from {cycleForm.start_date}
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCycleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Generating..." : "Generate Full Cycle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SWAP DUTY TURN */}
      {isSwapModalOpen && selectedDutyForSwap && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-indigo-100 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-bold text-base text-charcoal flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-indigo" />
                <span>Swap Dishwashing Turn</span>
              </h3>
              <button onClick={() => setIsSwapModalOpen(false)} className="p-1 text-charcoal/40 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-charcoal/70">
              Swap duty turn for <strong>{selectedDutyForSwap.assigned_name}</strong> on <strong>{selectedDutyForSwap.duty_date}</strong> with another scheduled Sunday.
            </p>

            <form onSubmit={handleExecuteSwap} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-charcoal mb-1">Select Target Sunday to Swap With *</label>
                <select
                  required
                  value={targetDutyId}
                  onChange={(e) => setTargetDutyId(e.target.value)}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo cursor-pointer"
                >
                  <option value="">-- Pick Sunday to Swap with --</option>
                  {duties
                    .filter(d => d.id !== selectedDutyForSwap.id)
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        {d.duty_date} — {d.assigned_name} {d.partner_assigned_name ? `& ${d.partner_assigned_name}` : ''} ({d.status})
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSwapModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !targetDutyId}
                  className="px-5 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? "Swapping..." : "Confirm Swap"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

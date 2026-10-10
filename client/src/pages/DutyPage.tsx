import { FilterPanel } from "../components/common/FilterPanel";
import { Pagination } from "../components/common/Pagination";
import { useListPagination } from "../hooks/useListPagination";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/common/Button";
import { ModalPanel } from "../components/common/ModalPanel";
import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { useSocketEvent } from "../socket";
import { DutyPageSkeleton, CardGridSkeleton, TableSkeleton } from "../components/common/SkeletonLoader";
import { DutyTeam, SaturdayDutyScheduleItem, Member, Ministry } from "../types";
import { ConfirmationModal, ModalType } from "../components/common/ConfirmationModal";
import {
  CalendarCheck, Users, ShieldCheck, CheckCircle2, Clock, Plus,
  Trash2, Edit, RefreshCw, ArrowLeftRight, Check, X,
  AlertCircle, ChevronRight, Phone, CheckSquare, Calendar,
  UserCheck, UserPlus, Search, Filter, Award
} from "lucide-react";

export interface DutyChecklistItem {
  id: string;
  task: string;
  desc: string;
  completed?: boolean;
}

export interface DutyGuidelineCard {
  id: string;
  title: string;
  desc: string;
  color: "amber" | "indigo" | "emerald" | "rose" | "teal" | "sky" | "violet";
}

const DEFAULT_DUTY_CHECKLIST: DutyChecklistItem[] = [
  { id: "duty-1", task: "Sanctuary Sweeping & Mopping", desc: "Clean altar, aisles, pews, and pulpit area." },
  { id: "duty-2", task: "Restroom Sanitization", desc: "Restock toilet paper, soap, clean sinks and mirrors." },
  { id: "duty-3", task: "Trash Disposal & Replacement", desc: "Empty all indoor trash bins and replace liners." },
  { id: "duty-4", task: "Sound & Audio Visual Setup", desc: "Check microphones, sound console, projector screen." },
  { id: "duty-5", task: "Fellowship Area Preparation", desc: "Clean tables, wash coffee cups, wipe counters." },
  { id: "duty-6", task: "Entrance Porch & Perimeter", desc: "Sweep foyer entrance, ensure welcome mats are clean." },
];

const DEFAULT_DUTY_GUIDELINES: DutyGuidelineCard[] = [
  {
    id: "guide-1",
    title: "Call Time & Attendance",
    desc: "Duty teams convene at the church premises every Saturday by 1:00 PM - 3:00 PM. Team Leaders coordinate attendance in advance.",
    color: "amber"
  },
  {
    id: "guide-2",
    title: "Schedule Swaps",
    desc: "If team members have personal conflicts on their designated Saturday, use the \"Swap Saturday Team\" button to trade dates with another team.",
    color: "indigo"
  },
  {
    id: "guide-3",
    title: "Automatic Weekly Rota",
    desc: "The system automatically cycles to the next scheduled team every week according to the turn order.",
    color: "emerald"
  }
];

const getDutyGuidelineTheme = (color: string) => {
  switch (color) {
    case "amber":
      return { bg: "bg-amber-50/90", border: "border-amber-200", title: "text-amber-950", desc: "text-amber-900" };
    case "emerald":
      return { bg: "bg-emerald-50/90", border: "border-emerald-200", title: "text-emerald-950", desc: "text-emerald-900" };
    case "rose":
      return { bg: "bg-rose-50/90", border: "border-rose-200", title: "text-rose-950", desc: "text-rose-900" };
    case "teal":
      return { bg: "bg-teal-50/90", border: "border-teal-200", title: "text-teal-950", desc: "text-teal-900" };
    case "sky":
      return { bg: "bg-sky-50/90", border: "border-sky-200", title: "text-sky-950", desc: "text-sky-900" };
    case "violet":
      return { bg: "bg-violet-50/90", border: "border-violet-200", title: "text-violet-950", desc: "text-violet-900" };
    case "indigo":
    default:
      return { bg: "bg-indigo-50/90", border: "border-indigo-200", title: "text-indigo-950", desc: "text-indigo-900" };
  }
};

export const DutyPage: React.FC = () => {
  const { user, ministries, selectedMinistryId } = useAuth();
  const { showToast, deleteWithUndo } = useToast();
  const isCoordinator = user?.role_name === "Coordinator";
  const canManage = user?.role_name === "Admin" || user?.role_name === "Pastor" || user?.role_name === "IT Admin";
  const coordinatorMinistryId = isCoordinator && user?.ministries && user.ministries.length > 0
    ? user.ministries[0].id
    : (user?.role_name !== "Admin" && user?.role_name !== "Pastor" && user?.role_name !== "IT Admin" && selectedMinistryId ? selectedMinistryId : null);
  const coordinatorMinistryName = user?.ministries && user.ministries.length > 0 ? user.ministries[0].name : "Youth";
  const activeScope = coordinatorMinistryId ?? selectedMinistryId ?? undefined;

  const [activeTab, setActiveTab] = useState<"teams" | "schedule" | "tasks">("teams");
  const [teams, setTeams] = useState<DutyTeam[]>([]);
  const [schedule, setSchedule] = useState<SaturdayDutyScheduleItem[]>([]);
  const [churchMembers, setChurchMembers] = useState<Member[]>([]);
  const [allMinistries, setAllMinistries] = useState<Ministry[]>(ministries || []);
  const [loading, setLoading] = useState(true);

  // Dynamic Duty Checklist & Guidelines State
  const [dutyChecklist, setDutyChecklist] = useState<DutyChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem("dpc_saturday_duty_checklist");
      return saved ? JSON.parse(saved) : DEFAULT_DUTY_CHECKLIST;
    } catch {
      return DEFAULT_DUTY_CHECKLIST;
    }
  });

  const [dutyGuidelines, setDutyGuidelines] = useState<DutyGuidelineCard[]>(() => {
    try {
      const saved = localStorage.getItem("dpc_duty_guidelines");
      return saved ? JSON.parse(saved) : DEFAULT_DUTY_GUIDELINES;
    } catch {
      return DEFAULT_DUTY_GUIDELINES;
    }
  });

  // Task Modal State
  const [isDutyTaskModalOpen, setIsDutyTaskModalOpen] = useState(false);
  const [editingDutyTask, setEditingDutyTask] = useState<DutyChecklistItem | null>(null);
  const [dutyTaskForm, setDutyTaskForm] = useState({ task: "", desc: "" });

  // Guideline Modal State
  const [isGuidelineModalOpen, setIsGuidelineModalOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<DutyGuidelineCard | null>(null);
  const [guidelineForm, setGuidelineForm] = useState<{
    title: string;
    desc: string;
    color: "amber" | "indigo" | "emerald" | "rose" | "teal" | "sky" | "violet";
  }>({
    title: "",
    desc: "",
    color: "amber"
  });

  const saveDutyChecklist = (newChecklist: DutyChecklistItem[]) => {
    setDutyChecklist(newChecklist);
    localStorage.setItem("dpc_saturday_duty_checklist", JSON.stringify(newChecklist));
  };

  const saveDutyGuidelines = (newGuidelines: DutyGuidelineCard[]) => {
    setDutyGuidelines(newGuidelines);
    localStorage.setItem("dpc_duty_guidelines", JSON.stringify(newGuidelines));
  };

  const handleOpenAddDutyTask = () => {
    setEditingDutyTask(null);
    setDutyTaskForm({ task: "", desc: "" });
    setIsDutyTaskModalOpen(true);
  };

  const handleOpenEditDutyTask = (item: DutyChecklistItem) => {
    setEditingDutyTask(item);
    setDutyTaskForm({ task: item.task, desc: item.desc });
    setIsDutyTaskModalOpen(true);
  };

  const handleSaveDutyTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dutyTaskForm.task.trim()) {
      showAlert("Missing Title", "Please enter a task title.");
      return;
    }

    if (editingDutyTask) {
      const updated = dutyChecklist.map(t =>
        t.id === editingDutyTask.id ? { ...t, task: dutyTaskForm.task.trim(), desc: dutyTaskForm.desc.trim() } : t
      );
      saveDutyChecklist(updated);
    } else {
      const newTask: DutyChecklistItem = {
        id: `duty-${Date.now()}`,
        task: dutyTaskForm.task.trim(),
        desc: dutyTaskForm.desc.trim(),
        completed: false
      };
      saveDutyChecklist([...dutyChecklist, newTask]);
    }
    setIsDutyTaskModalOpen(false);
  };

  const handleDeleteDutyTask = (id: string) => {
    const updated = dutyChecklist.filter(t => t.id !== id);
    saveDutyChecklist(updated);
  };

  const handleToggleDutyTask = (id: string) => {
    const updated = dutyChecklist.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    saveDutyChecklist(updated);
  };

  const handleOpenAddGuideline = () => {
    setEditingGuideline(null);
    setGuidelineForm({ title: "", desc: "", color: "amber" });
    setIsGuidelineModalOpen(true);
  };

  const handleOpenEditGuideline = (item: DutyGuidelineCard) => {
    setEditingGuideline(item);
    setGuidelineForm({ title: item.title, desc: item.desc, color: item.color || "amber" });
    setIsGuidelineModalOpen(true);
  };

  const handleSaveGuideline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guidelineForm.title.trim()) {
      showAlert("Missing Title", "Please enter guideline card title.");
      return;
    }

    if (editingGuideline) {
      const updated = dutyGuidelines.map(g =>
        g.id === editingGuideline.id ? { ...g, title: guidelineForm.title.trim(), desc: guidelineForm.desc.trim(), color: guidelineForm.color } : g
      );
      saveDutyGuidelines(updated);
    } else {
      const newGuide: DutyGuidelineCard = {
        id: `guide-${Date.now()}`,
        title: guidelineForm.title.trim(),
        desc: guidelineForm.desc.trim(),
        color: guidelineForm.color
      };
      saveDutyGuidelines([...dutyGuidelines, newGuide]);
    }
    setIsGuidelineModalOpen(false);
  };

  const handleDeleteGuideline = (id: string, title: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: "Delete Guideline Card",
      type: "danger",
      confirmText: "Delete",
      description: (
        <p className="text-xs text-charcoal/80 text-center">
          Are you sure you want to remove <strong>"{title}"</strong>?
        </p>
      ),
      onConfirm: () => {
        const updated = dutyGuidelines.filter(g => g.id !== id);
        saveDutyGuidelines(updated);
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleResetDutyDefaults = () => {
    setConfirmModalConfig({
      isOpen: true,
      title: "Reset Duty Protocols to Default",
      type: "warning",
      confirmText: "Reset to Defaults",
      description: (
        <p className="text-xs text-charcoal/80 text-center">
          This will restore the standard Saturday cleaning checklist and duty team best practices.
        </p>
      ),
      onConfirm: () => {
        saveDutyChecklist(DEFAULT_DUTY_CHECKLIST);
        saveDutyGuidelines(DEFAULT_DUTY_GUIDELINES);
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Custom Confirmation & Alert Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    type: ModalType;
    confirmText?: string;
    cancelText?: string | null;
    isLoading?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info",
    confirmText: "Confirm",
    onConfirm: () => {}
  });

  const showAlert = (title: string, message: string, type: ModalType = "danger") => {
    setConfirmModalConfig({
      isOpen: true,
      title,
      type,
      confirmText: "Okay",
      cancelText: null,
      description: <p className="text-xs text-charcoal/80 text-center">{message}</p>,
      onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Team modal state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<DutyTeam | null>(null);
  const [teamForm, setTeamForm] = useState<{
    name: string;
    order_seq: number;
    leader_id: string;
    color: string;
    tasks_checklist: string;
    selectedMemberIds: number[];
  }>({
    name: "",
    order_seq: 1,
    leader_id: "",
    color: "#2C3968",
    tasks_checklist: "Sanctuary Cleaning, Sound Setup, Trash Disposal, Restroom Sanitization",
    selectedMemberIds: []
  });

  // Multi-member selector modal state
  const [isMultiMemberSelectorOpen, setIsMultiMemberSelectorOpen] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<"team_form" | "existing_team">("team_form");
  const [targetTeam, setTargetTeam] = useState<DutyTeam | null>(null);
  const [selectorSearchQuery, setSelectorSearchQuery] = useState("");
  const [selectorMinistryFilter, setSelectorMinistryFilter] = useState("");
  const [selectorSelectedIds, setSelectorSelectedIds] = useState<Set<number>>(new Set());

  // Swap modal state
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapItem1, setSwapItem1] = useState<SaturdayDutyScheduleItem | null>(null);
  const [swapTargetDate, setSwapTargetDate] = useState<string>("");
  const [isSubmittingSwap, setIsSubmittingSwap] = useState(false);

  useEffect(() => {
    if (ministries && ministries.length > 0) {
      setAllMinistries(ministries);
    }
  }, [ministries]);

  useEffect(() => {
    loadDutyData();
  }, [selectedMinistryId, coordinatorMinistryId]);

  // Real-time synchronization
  useSocketEvent("duty:changed", () => {
    loadDutyData();
  });
  useSocketEvent("members:changed", () => {
    loadDutyData();
  });
  useSocketEvent("ministries:changed", () => {
    loadDutyData();
  });

 const loadDutyData = async () => {
    guideData.clearError();
    try {
      setLoading(true);
      const [teamsData, scheduleData, membersData, ministriesData] = await Promise.all([
        api.getDutyTeams(activeScope),
        api.getDutySchedule({ ministry_id: activeScope, count: 12 }),
        api.getMembers({ status: "active" }), // fetch all church members across all ministries
        api.getMinistries().catch(() => [])
      ]);
      setTeams(teamsData);
      setSchedule(scheduleData.schedule);
      setChurchMembers([...membersData].sort((a, b) => {
        const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
        const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      }));
      if (ministriesData && ministriesData.length > 0) {
        setAllMinistries(ministriesData);
      }
    } catch (err) {
      console.error("Failed to load duty roster:", err);
      guideData.reportError(err);
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
      tasks_checklist: "Sanctuary Cleaning, Trash Disposal, Sound & Audio Checks, Restroom Sanitization",
      selectedMemberIds: []
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
      tasks_checklist: team.tasks_checklist || "",
      selectedMemberIds: team.members?.map(m => m.member_id) || []
    });
    setIsTeamModalOpen(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamForm.name.trim()) {
      showAlert("Team Name Required", "Please enter a duty team name.", "warning");
      return;
    }

    const dup = teams.find(t =>
      t.name.toLowerCase().trim() === teamForm.name.toLowerCase().trim() &&
      t.id !== editingTeam?.id
    );
    if (dup) {
      showAlert("Duplicate Team Name", `A duty team named "${teamForm.name.trim()}" already exists.`, "warning");
      return;
    }

    if (!teamForm.order_seq || Number(teamForm.order_seq) < 1) {
      showAlert("Invalid Order Sequence", "Order sequence must be at least 1.", "warning");
      return;
    }

    try {
      if (editingTeam) {
        await api.updateDutyTeam(editingTeam.id, {
          name: teamForm.name.trim(),
          order_seq: Number(teamForm.order_seq),
          leader_id: teamForm.leader_id ? Number(teamForm.leader_id) : undefined,
          color: teamForm.color,
          tasks_checklist: teamForm.tasks_checklist || undefined
        });
        showAlert("Team Updated", `Updated ${teamForm.name} successfully!`, "success");
      } else {
        await api.createDutyTeam({
          name: teamForm.name.trim(),
          order_seq: Number(teamForm.order_seq),
          leader_id: teamForm.leader_id ? Number(teamForm.leader_id) : undefined,
          color: teamForm.color,
          tasks_checklist: teamForm.tasks_checklist || undefined,
          member_ids: teamForm.selectedMemberIds
        });
        showAlert("Team Created", `Created ${teamForm.name} successfully!`, "success");
      }
      setIsTeamModalOpen(false);
      loadDutyData();
    } catch (err: any) {
      showAlert("Operation Failed", err.message || "Could not save duty team.", "danger");
    }
  };

  const handleDeleteTeam = (teamId: number, name: string) => {
    const originalTeams = teams;
    deleteWithUndo({
      itemName: name,
      itemType: "Saturday duty team",
      onOptimisticDelete: () => {
        setTeams((prev) => prev.filter((t) => t.id !== teamId));
      },
      onRestore: () => {
        setTeams(originalTeams);
      },
      onCommitDelete: async () => {
        await api.deleteDutyTeam(teamId);
      }
    });
  };

  const handleOpenAddMember = (team: DutyTeam) => {
    handleOpenMultiMemberSelector("existing_team", team);
  };

  const handleOpenSelectorForForm = () => {
    handleOpenMultiMemberSelector("team_form");
  };

  const handleRemoveMemberFromForm = (memberId: number) => {
    setTeamForm(prev => ({
      ...prev,
      selectedMemberIds: prev.selectedMemberIds.filter(id => id !== memberId)
    }));
  };

  const handleOpenMultiMemberSelector = (target: "team_form" | "existing_team", team?: DutyTeam) => {
    setSelectorTarget(target);
    setTargetTeam(team || null);
    setSelectorSearchQuery("");
    setSelectorMinistryFilter("");

    if (target === "team_form") {
      setSelectorSelectedIds(new Set(teamForm.selectedMemberIds));
    } else if (target === "existing_team" && team) {
      const currentIds = team.members?.map(m => m.member_id) || [];
      setSelectorSelectedIds(new Set(currentIds));
    }
    setIsMultiMemberSelectorOpen(true);
  };

  const handleToggleSelectorMember = (memberId: number) => {
    setSelectorSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleToggleMemberSelection = (memberId: number) => {
    handleToggleSelectorMember(memberId);
  };

  const filteredSelectorMembers = useMemo(() => {
    return churchMembers.filter((m) => {
      const matchesSearch =
        !selectorSearchQuery ||
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(selectorSearchQuery.toLowerCase()) ||
        (m.contact_phone && m.contact_phone.includes(selectorSearchQuery)) ||
        (m.contact_email && m.contact_email.toLowerCase().includes(selectorSearchQuery.toLowerCase()));

      const matchesMinistry =
        !selectorMinistryFilter ||
        String(m.ministry_id) === selectorMinistryFilter ||
        (m.ministry_name && m.ministry_name.toLowerCase() === selectorMinistryFilter.toLowerCase()) ||
        (allMinistries.find(min => String(min.id) === selectorMinistryFilter)?.name.toLowerCase() === m.ministry_name?.toLowerCase());

      return matchesSearch && matchesMinistry;
    }).sort((a, b) => {
      const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
      const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [churchMembers, selectorSearchQuery, selectorMinistryFilter, allMinistries]);

  const handleSelectAllFiltered = () => {
    setSelectorSelectedIds((prev) => {
      const next = new Set(prev);
      filteredSelectorMembers.forEach((m) => next.add(m.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectorSelectedIds(new Set());
  };

  const handleConfirmSelector = async () => {
    if (selectorTarget === "team_form") {
      setTeamForm(prev => ({
        ...prev,
        selectedMemberIds: Array.from(selectorSelectedIds)
      }));
      setIsMultiMemberSelectorOpen(false);
    } else if (selectorTarget === "existing_team" && targetTeam) {
      const existingMemberIds = new Set(targetTeam.members?.map(m => m.member_id) || []);
      const newlyAddedIds = Array.from(selectorSelectedIds).filter(id => !existingMemberIds.has(id));

      if (newlyAddedIds.length === 0) {
        setIsMultiMemberSelectorOpen(false);
        return;
      }

      try {
        await api.addDutyTeamMember(targetTeam.id, {
          member_ids: newlyAddedIds,
          role: "Member"
        });
        setIsMultiMemberSelectorOpen(false);
        loadDutyData();
      } catch (err: any) {
        setConfirmModalConfig({
          isOpen: true,
          title: "Failed to Add Members",
          type: "danger",
          confirmText: "Close",
          cancelText: null,
          description: err.message || "Failed to add members to team.",
          onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
        });
      }
    }
  };

  const handleRemoveMember = (teamId: number, memberId: number, memberName: string) => {
    const targetTeam = teams.find((t) => t.id === teamId);
    const originalMembers = targetTeam?.members || [];

    deleteWithUndo({
      itemName: memberName,
      itemType: "Team member",
      onOptimisticDelete: () => {
        setTeams((prev) =>
          prev.map((t) =>
            t.id === teamId
              ? { ...t, members: (t.members || []).filter((m) => m.member_id !== memberId) }
              : t
          )
        );
      },
      onRestore: () => {
        setTeams((prev) =>
          prev.map((t) =>
            t.id === teamId ? { ...t, members: originalMembers } : t
          )
        );
      },
      onCommitDelete: async () => {
        await api.removeDutyTeamMember(teamId, memberId);
      }
    });
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
      showAlert("Cannot Swap", "Both Saturdays must have teams assigned to swap.", "warning");
      return;
    }

    try {
      setIsSubmittingSwap(true);
      await api.swapSaturdayDuty({
        date1: swapItem1.duty_date,
        teamId1: swapItem1.team.id,
        date2: targetItem.duty_date,
        teamId2: targetItem.team.id,
        ministry_id: coordinatorMinistryId || null
      });
      showToast(`Successfully swapped Saturday duty between ${swapItem1.date_formatted} and ${targetItem.date_formatted}!`, "success");
      setIsSwapModalOpen(false);
      setSwapItem1(null);
      await loadDutyData();
    } catch (err: any) {
      showAlert("Swap Failed", err.message || "Failed to swap duty teams", "danger");
    } finally {
      setIsSubmittingSwap(false);
    }
  };

  const handleCompleteDuty = async (item: SaturdayDutyScheduleItem) => {
    if (!item.team) return;
    setConfirmModalConfig({
      isOpen: true,
      title: "Mark Saturday Duty as Completed",
      type: "info",
      confirmText: "Mark Completed",
      description: (
        <p className="text-xs text-charcoal/80 text-center">
          Mark <strong>{item.date_formatted}</strong> duty for <strong>{item.team.name}</strong> as completed?
        </p>
      ),
      onConfirm: async () => {
        try {
          await api.completeSaturdayDuty({
            duty_date: item.duty_date,
            team_id: item.team!.id,
            ministry_id: coordinatorMinistryId || null
          });
          showToast(`Saturday duty for ${item.date_formatted} marked as completed!`, "success");
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
          loadDutyData();
        } catch (err: any) {
          showAlert("Error", err.message || "Failed to mark duty complete", "danger");
        }
      }
    });
  };

  const handleResetScheduleOverrides = () => {
    setConfirmModalConfig({
      isOpen: true,
      title: "Reset Duty Roster to Automatic Cycle",
      type: "warning",
      confirmText: "Reset to Cycle",
      description: (
        <p className="text-xs text-charcoal/80 text-center">
          This will clear all manual swaps and date overrides, restoring the default rotating schedule across all {teams.length} teams.
        </p>
      ),
      onConfirm: async () => {
        try {
          await api.resetSaturdayDuty({
            ministry_id: coordinatorMinistryId || null
          });
          showToast("Saturday duty roster reset to automatic cycle!", "success");
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
          loadDutyData();
        } catch (err: any) {
          showAlert("Error", err.message || "Failed to reset schedule", "danger");
        }
      }
    });
  };

  // Find this Saturday's item
  const thisSaturday = schedule[0] || null;

  const teamsPage = useListPagination(teams, String(activeScope));
  const schedulePage = useListPagination(schedule.map((item, index) => ({ item, index })), String(activeScope));
  const guideData = useGuideDataState("duty-teams", { loading, count: teams.length, filtered: Boolean(activeScope), retry: loadDutyData });

  if (loading && teams.length === 0) {
    return <DutyPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <PageHeader icon={<Calendar />} title={<>Saturday Duty Roster & Rotating Teams</>}
        description={<>Weekly Saturday service preparation, church facility cleaning, and rotating team duty cycle.</>}
        actions={<><div className="relative z-10 flex items-center gap-2.5">
          <Button onClick={loadDutyData} title="Refresh schedule" variant="secondary" size="icon">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin " : ""}`} />
          </Button>
          {canManage && (
            <Button data-guide="duty-new" onClick={handleOpenCreateTeam} variant="primary">
              <Plus className="w-4 h-4 " />
              <span>Create Team</span>
            </Button>
          )}
        </div></>} />

      {/* Hero Card: THIS SATURDAY'S ON-DUTY TEAM */}
      {thisSaturday && thisSaturday.team && (
        <div className="relative overflow-hidden bg-white rounded-2xl p-7 sm:p-8 text-charcoal shadow-sm border border-stone-200">




          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="bg-amber-400 text-indigo-950 font-medium text-[12px] px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-indigo-950" />
                  <span>THIS SATURDAY ON DUTY</span>
                </span>
                <span className="text-xs text-muted font-medium bg-stone-50 px-3 py-1 rounded-full  border border-stone-200">
                  {thisSaturday.date_formatted}
                </span>
                {thisSaturday.status === "completed" && (
                  <span className="bg-emerald-500/20 text-muted border border-emerald-400/40 text-[12px] font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Completed</span>
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-charcoal flex items-center gap-3">
                  <span>{thisSaturday.team.name}</span>
                  <span
                    className="w-4 h-4 rounded-full ring-2 ring-white/60 shadow-md inline-block"
                    style={{ backgroundColor: thisSaturday.team.color }}
                  ></span>
                </h2>
                <p className="text-xs text-muted mt-1.5 max-w-xl leading-relaxed">
                  Responsibilities: {thisSaturday.notes || thisSaturday.team.tasks_checklist || "Sanctuary Cleaning, Restrooms, Trash, Audio Setup"}
                </p>
              </div>

              {/* Leader & Roster Preview */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="bg-stone-50  px-3.5 py-2 rounded-2xl border border-stone-200 flex items-center gap-2 shadow-2xs">
                  <UserCheck className="w-4 h-4 text-muted" />
                  <span className="text-xs font-medium">
                    Leader: <strong className="text-charcoal font-medium">{thisSaturday.team.leader_name || "Unassigned"}</strong>
                  </span>
                  {thisSaturday.team.leader_phone && (
                    <span className="text-[12px] text-muted font-mono">({thisSaturday.team.leader_phone})</span>
                  )}
                </div>

                <div className="bg-stone-50  px-3.5 py-2 rounded-2xl border border-stone-200 flex items-center gap-2 shadow-2xs">
                  <Users className="w-4 h-4 text-muted" />
                  <span className="text-xs font-medium">
                    Team Strength: <strong className="text-charcoal font-medium">{thisSaturday.team.members?.length || thisSaturday.team.members_count || 0} Members</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
              <div className="text-xs text-muted font-medium bg-stone-50 border border-stone-200 px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-xs ">
                <CheckCircle2 className="w-4 h-4 text-muted" />
                <span>Active Rotation • {thisSaturday.date_formatted}</span>
              </div>

              {canManage && (<button data-guide="duty-swap"
                onClick={() => handleOpenSwapModal(thisSaturday)}
                className="flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 text-charcoal font-medium text-xs py-2.5 px-4 rounded-2xl border border-stone-200 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <ArrowLeftRight className="w-4 h-4 text-muted" />
                <span>Swap Saturday Team</span>
              </button>)}
            </div>
          </div>

          {/* Member chips row */}
          {thisSaturday.team.members && thisSaturday.team.members.length > 0 && (
            <div className="mt-5 pt-4 border-t border-stone-200 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium uppercase tracking-wider text-muted">Duty Disciples:</span>
              {thisSaturday.team.members.map((m, idx) => (
                <span
                  key={idx}
                  className="bg-stone-50 hover:bg-stone-100 border border-stone-200 px-3 py-1 rounded-xl text-xs font-medium text-charcoal flex items-center gap-1.5 shadow-2xs "
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>{m.first_name} {m.last_name}</span>
                  {m.team_role === "Team Leader" && (
                    <span className="text-[12px] bg-amber-400 text-indigo-950 font-medium px-1.5 py-0.2 rounded-md">LEAD</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="page-tabs flex items-center bg-white/95 p-1.5 rounded-2xl border border-indigo-100/90 shadow-2xs w-fit gap-1.5">
        <button
          onClick={() => setActiveTab("teams")}
          data-guide="duty-teams-tab"
          className={`flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl transition-all cursor-pointer ${activeTab === "teams"
            ? "bg-indigo-950 text-white shadow-xs"
            : "text-charcoal/70 hover:text-indigo-950 hover:bg-indigo-50/50"
            }`}
         aria-pressed={activeTab === "teams"}>
          <Users className="w-4 h-4" />
          <span>Duty Teams ({teams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("schedule")}
          data-guide="duty-schedule-tab"
          className={`flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl transition-all cursor-pointer ${activeTab === "schedule"
            ? "bg-indigo-950 text-white shadow-xs"
            : "text-charcoal/70 hover:text-indigo-950 hover:bg-indigo-50/50"
            }`}
         aria-pressed={activeTab === "schedule"}>
          <Calendar className="w-4 h-4" />
          <span>Saturday Rotation Cycle ({schedule.length} Weeks)</span>
        </button>

        <button data-guide="duty-checklist-tab"
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl transition-all cursor-pointer ${activeTab === "tasks"
            ? "bg-indigo-950 text-white shadow-xs"
            : "text-charcoal/70 hover:text-indigo-950 hover:bg-indigo-50/50"
            }`}
         aria-pressed={activeTab === "tasks"}>
          <CheckSquare className="w-4 h-4" />
          <span>Duty Checklist</span>
        </button>
      </div>

      {/* TAB 1: TEAMS MANAGEMENT */}
      {activeTab === "teams" && (
        <div data-guide="duty-teams" className="space-y-4">
          {loading && teams.length === 0 ? (
            <CardGridSkeleton count={6} columns={3} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamsPage.items.map((team) => (
                <div
                  key={team.id}
                  className="bg-white/95 rounded-3xl border border-indigo-100/90 hover:border-amber-400 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Team Card Header */}
                    <div className="flex items-center justify-between pb-3.5 border-b border-indigo-50">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded-full shadow-inner ring-2 ring-white"
                          style={{ backgroundColor: team.color }}
                        ></span>
                        <div>
                          <h3 className="font-semibold text-base text-indigo-950">{team.name}</h3>
                          <span className="text-[12px] text-indigo-950 font-medium bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                            Turn #{team.order_seq}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canManage && (<button
                          onClick={() => handleOpenEditTeam(team)}
                          className="p-2 text-muted hover:text-indigo-950 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                          title="Edit Team"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>)}
                        {canManage && (<button
                          onClick={() => handleDeleteTeam(team.id, team.name)}
                          className="p-2 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Delete Team"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>)}
                      </div>
                    </div>

                    {/* Leader Banner */}
                    <div className="mt-3.5 bg-ivory-light/70 p-3 rounded-2xl border border-indigo-50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <UserCheck className="w-4 h-4 text-amber-500" />
                        <div>
                          <span className="text-[12px] text-muted block font-medium">Team Leader</span>
                          <span className="font-medium text-indigo-950">{team.leader_name || "Unassigned"}</span>
                        </div>
                      </div>
                      {team.leader_phone && (
                        <span className="text-[12px] text-indigo-900 font-mono font-medium">{team.leader_phone}</span>
                      )}
                    </div>

                    {/* Member Roster Chips */}
                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-medium text-indigo-950">
                        <span>Assigned Disciples ({team.members?.length || 0})</span>
                        {canManage && (<button
                          onClick={() => handleOpenAddMember(team)}
                          className="text-indigo-950 hover:text-amber-600 text-[12px] flex items-center gap-1 font-medium cursor-pointer transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add Member</span>
                        </button>)}
                      </div>

                      {team.members && team.members.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {[...team.members]
                            .sort((a, b) => {
                              if (a.team_role === "Team Leader" && b.team_role !== "Team Leader") return -1;
                              if (b.team_role === "Team Leader" && a.team_role !== "Team Leader") return 1;
                              const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
                              const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
                              return nameA.localeCompare(nameB);
                            })
                            .map((m) => (
                            <div
                              key={m.member_id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-ivory-light/60 hover:bg-ivory-light border border-indigo-50/80 text-xs transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                <span className="font-medium text-indigo-950">
                                  {m.first_name} {m.last_name}
                                </span>
                                {m.team_role === "Team Leader" && (
                                  <span className="text-[12px] bg-amber-100 text-amber-950 font-medium px-2 py-0.2 rounded-md border border-amber-300">
                                    Lead
                                  </span>
                                )}
                              </div>

                              {canManage && (<button
                                onClick={() => handleRemoveMember(team.id, m.member_id, `${m.first_name} ${m.last_name}`)}
                                className="p-1 text-muted hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                                title="Remove from team"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl border border-dashed border-indigo-200 text-center text-xs text-muted">
                          No members assigned yet.
                          {canManage && (<button
                            onClick={() => handleOpenAddMember(team)}
                            className="block mx-auto mt-1 text-indigo-950 font-medium underline cursor-pointer"
                          >
                            + Add first member
                          </button>)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Team Footer Checklist Preview */}
                  <div className="pt-3 border-t border-indigo-50 text-[12px] text-muted line-clamp-2">
                    <span className="font-medium text-charcoal/80">Duty Checklist:</span>{" "}
                    {team.tasks_checklist || "General Saturday sanctuary cleaning and preparations."}
                  </div>
                </div>
              ))}
            </div>
          )}

          {teams.length === 0 && !loading && (
            <div className="p-12 text-center bg-white rounded-3xl border border-indigo-100 shadow-sm">
              <Users className="w-12 h-12 text-charcoal/30 mx-auto mb-3" />
              <h3 className="font-semibold text-indigo-950 text-base">No Duty Teams Created</h3>
              <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                Create Team 1, Team 2, and more to set up a seamless rotating Saturday duty cycle.
              </p>
              {canManage && (<button data-guide="duty-new"
                onClick={handleOpenCreateTeam}
                className="mt-4 bg-indigo-950 text-white font-medium text-xs px-5 py-2.5 rounded-xl shadow-xs"
              >
                + Create Team 1
              </button>)}
            </div>
          )}
        </div>
      )}

      {activeTab === "teams" && <Pagination label="duty teams" page={teamsPage.page} pageSize={teamsPage.pageSize} total={teamsPage.total} onPageChange={teamsPage.setPage} onPageSizeChange={teamsPage.setPageSize} loading={loading} />}

      {/* TAB 2: SATURDAY ROTATION CYCLE TIMELINE */}
      {activeTab === "schedule" && (
        <div data-guide="duty-schedule" className="bg-white/95 rounded-3xl border border-indigo-100/90 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-indigo-50">
            <div>
              <h2 className="text-base font-semibold text-indigo-950 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-700" />
                <span>Upcoming Saturday Rotation Schedule</span>
              </h2>
              <p className="text-xs text-muted">
                Teams automatically cycle every Saturday ({teams.length}-week repeat interval).
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canManage && (
                <button
                  onClick={handleResetScheduleOverrides}
                  className="text-xs font-medium text-muted hover:text-indigo-950 hover:bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Reset all manual swaps and date overrides back to automatic cycle"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset to Cycle</span>
                </button>
              )}
              <span className="text-xs font-medium text-emerald-950 bg-emerald-100 border border-emerald-300 px-3.5 py-1 rounded-full">
                Cycle Active: {teams.length} Teams
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {schedulePage.items.map(({ item, index: idx }) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${item.is_this_saturday
                  ? "bg-indigo-50/40 border-amber-300 shadow-xs ring-2 ring-amber-300/30"
                  : item.status === "completed"
                    ? "bg-emerald-50/40 border-emerald-200/80"
                    : item.status === "swapped"
                      ? "bg-amber-50/40 border-amber-200/80"
                      : "bg-white border-indigo-100/70 hover:border-indigo-200"
                  }`}
              >
                <div className="flex items-center gap-4">
                  {/* Week & Date badge */}
                  <div className="w-28 shrink-0">
                    <span className="text-[12px] font-medium uppercase tracking-wider text-muted block">
                      Week {item.week_number}
                    </span>
                    <span className="text-xs font-medium text-indigo-950 block">
                      {item.date_formatted}
                    </span>
                    {item.is_this_saturday && (
                      <span className="text-[12px] bg-amber-400 text-indigo-950 font-medium px-2 py-0.2 rounded-full uppercase tracking-wide inline-block mt-0.5 shadow-2xs">
                        This Saturday
                      </span>
                    )}
                  </div>

                  {/* Team Assignment */}
                  {item.team ? (
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-inner ring-1 ring-white"
                        style={{ backgroundColor: item.team.color }}
                      ></span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-indigo-950">{item.team.name}</h4>
                          <span className="text-[12px] text-muted font-medium">
                            ({item.team.members?.length || item.team.members_count || 0} Members)
                          </span>
                        </div>
                        <span className="text-[12px] text-muted">
                          Leader: <strong className="text-indigo-950 font-medium">{item.team.leader_name || "Assigned"}</strong>
                        </span>
                        {item.status === "swapped" && item.notes && (
                          <p className="text-[12px] text-amber-800 font-medium mt-0.5">
                            ⇄ {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-rose-600 font-medium">No team assigned</span>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {item.status === "completed" ? (
                    <span className="bg-emerald-100 text-emerald-950 text-xs font-medium px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 border border-emerald-300 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Completed</span>
                    </span>
                  ) : item.status === "swapped" ? (
                    <span className="bg-amber-100 text-amber-950 text-xs font-medium px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 border border-amber-300 shadow-2xs">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-amber-700" />
                      <span>Swapped Turn</span>
                    </span>
                  ) : item.is_this_saturday ? (
                    <span className="bg-indigo-100 text-indigo-950 text-xs font-medium px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 border border-indigo-300 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Active This Saturday</span>
                    </span>
                  ) : item.is_next_saturday ? (
                    <span className="bg-amber-50 text-amber-950 text-xs font-medium px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-amber-200">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Next in Turn</span>
                    </span>
                  ) : (
                    <span className="bg-slate-50 text-charcoal/70 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200">
                      Turn #{item.team?.order_seq || item.week_number}
                    </span>
                  )}

                  {canManage && item.status !== "completed" && (
                    <button
                      onClick={() => handleCompleteDuty(item)}
                      className="p-2 hover:bg-emerald-50 rounded-xl text-muted hover:text-emerald-700 transition-colors cursor-pointer"
                      title="Mark as completed"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}

                  {canManage && (<button
                    onClick={() => handleOpenSwapModal(item)}
                    className="p-2 hover:bg-indigo-50 rounded-xl text-muted hover:text-indigo-950 transition-colors cursor-pointer"
                    title="Swap with another Saturday"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SATURDAY CHECKLIST & GUIDELINES (DYNAMIC & EDITABLE) */}
      {activeTab === "schedule" && <Pagination label="Saturday schedule" page={schedulePage.page} pageSize={schedulePage.pageSize} total={schedulePage.total} onPageChange={schedulePage.setPage} onPageSizeChange={schedulePage.setPageSize} loading={loading} />}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-white/95 rounded-3xl border border-indigo-100/90 shadow-sm">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-indigo-950 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-700" />
                <span>Saturday Duty Checklist & Ministry SOPs</span>
              </h2>
              <p className="text-xs text-muted">
                Standard cleaning procedures, equipment checks, and operational guidelines for scheduled teams
              </p>
            </div>

            {canManage && (
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={handleResetDutyDefaults}
                  className="px-3.5 py-2 text-xs font-medium text-muted hover:text-indigo-950 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Restore default duty checklist and guidelines"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
                <button data-guide="duty-guideline-new"
                  onClick={handleOpenAddGuideline}
                  className="px-3.5 py-2 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Guideline Card</span>
                </button>
                <button data-guide="duty-task-new"
                  onClick={handleOpenAddDutyTask}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-900  rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Checklist Task</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Card: Cleaning Checklist */}
            <div className="bg-white/95 rounded-3xl border border-indigo-100/90 p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-indigo-50">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-2xl bg-indigo-50 text-indigo-800 border border-indigo-100">
                      <CheckSquare className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-sm text-indigo-950">Standard Saturday Cleaning Checklist</h3>
                      <p className="text-[12px] text-muted">Follow this protocol each Saturday before Sunday service</p>
                    </div>
                  </div>

                  {canManage && (
                    <button data-guide="duty-task-new"
                      onClick={handleOpenAddDutyTask}
                      className="text-[12px] font-medium text-indigo-800 hover:text-indigo-950 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Task</span>
                    </button>
                  )}
                </div>

                <div className="mt-3.5 space-y-2.5 text-xs">
                  {dutyChecklist.map((item) => (
                    <div
                      key={item.id}
                      onClick={canManage ? () => handleToggleDutyTask(item.id) : undefined}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 group ${
                        item.completed
                          ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-950"
                          : "bg-ivory-light/70 hover:bg-indigo-50/40 border-indigo-50/80 text-charcoal"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {item.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        ) : (
                          <CheckSquare className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <span
                            className={`font-medium block leading-tight ${
                              item.completed ? "line-through text-muted" : "text-indigo-950"
                            }`}
                          >
                            {item.task}
                          </span>
                          {item.desc && (
                            <span
                              className={`text-[12px] mt-0.5 block leading-relaxed ${
                                item.completed ? "line-through text-charcoal/30" : "text-muted"
                              }`}
                            >
                              {item.desc}
                            </span>
                          )}
                        </div>
                      </div>

                      {canManage && (
                        <div
                          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleOpenEditDutyTask(item)}
                            className="p-1 text-muted hover:text-indigo-950 hover:bg-white rounded transition-colors"
                            title="Edit task"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDutyTask(item.id)}
                            className="p-1 text-muted hover:text-rose-600 hover:bg-white rounded transition-colors"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-xs text-indigo-950 font-medium mt-4">
                <span>Completed Tasks</span>
                <span className="bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200 text-indigo-900 font-medium">
                  {dutyChecklist.filter(t => t.completed).length} / {dutyChecklist.length}
                </span>
              </div>
            </div>

            {/* Right Card: Best Practices & Guidelines */}
            <div className="bg-white/95 rounded-3xl border border-indigo-100/90 p-6 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-indigo-50">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-sm text-indigo-950">Duty Team Best Practices</h3>
                      <p className="text-[12px] text-muted">Guidelines for leaders and Saturday volunteers</p>
                    </div>
                  </div>

                  {canManage && (
                    <button data-guide="duty-guideline-new"
                      onClick={handleOpenAddGuideline}
                      className="text-[12px] font-medium text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Card</span>
                    </button>
                  )}
                </div>

                <div className="mt-3.5 space-y-3 text-xs">
                  {dutyGuidelines.map((card) => {
                    const theme = getDutyGuidelineTheme(card.color);
                    const GuidelineIcon = card.id === "guide-1" ? Clock : card.id === "guide-2" ? ArrowLeftRight : CalendarCheck;
                    const title = card.title.replace(/^\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*\s*/u, "");
                    return (
                      <div
                        key={card.id}
                        className={`p-4 rounded-2xl border transition-all relative group ${theme.bg} ${theme.border}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className={`font-medium inline-flex items-center gap-1.5 mb-1 ${theme.title}`}><GuidelineIcon aria-hidden="true" className="w-4 h-4 shrink-0" />{title}</span>

                          {canManage && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => handleOpenEditGuideline(card)}
                                className="p-1 text-muted hover:text-indigo-950 hover:bg-white/80 rounded transition-colors"
                                title="Edit guideline"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteGuideline(card.id, card.title)}
                                className="p-1 text-muted hover:text-rose-600 hover:bg-white/80 rounded transition-colors"
                                title="Delete guideline"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className={`text-[12px] leading-relaxed ${theme.desc}`}>{card.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-950 text-white space-y-1.5 mt-4">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
                  <Award className="w-4 h-4" />
                  <span>Excellence in God's House</span>
                </div>
                <p className="text-[12px] text-indigo-100/80 leading-relaxed">
                  "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters." — Colossians 3:23
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Create / Edit Duty Team */}
      {isTeamModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div data-modal-header className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-charcoal flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo" />
                <span>{editingTeam ? "Edit Duty Team" : "Create New Duty Team"}</span>
              </h2>
              <button onClick={() => setIsTeamModalOpen(false)} className="p-1 text-muted hover:text-charcoal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form data-guide="duty-team-form" onSubmit={handleSaveTeam} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-charcoal/70 mb-1">Team Name *</label>
                  <input data-guide="duty-team-name"
                    type="text"
                    required
                    placeholder="e.g. Team 1, Team 2"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                </div>
                <div>
                  <label className="block font-medium text-charcoal/70 mb-1">Rotation Order (Seq)</label>
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
                <label className="block font-medium text-charcoal/70 mb-1">Assigned Team Leader</label>
                <select data-guide="duty-team-leader"
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
                <label className="block font-medium text-charcoal/70 mb-1">Team Color Tag</label>
                <div className="flex items-center gap-2">
                  {["#2C3968", "#E07A5F", "#6E8B74", "#D9A441", "#8D5B4C", "#4A5568"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTeamForm({ ...teamForm, color: c })}
                      className={`w-7 h-7 rounded-full transition-all ${teamForm.color === c ? "ring-3 ring-indigo-400 scale-110 shadow-sm" : "opacity-80"
                        }`}
                      style={{ backgroundColor: c }}
                    ></button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-medium text-charcoal/70">
                    Assigned Team Members ({teamForm.selectedMemberIds.length})
                  </label>
                  <button data-guide="duty-team-members"
                    type="button"
                    onClick={handleOpenSelectorForForm}
                    className="flex items-center gap-1.5 text-indigo-950 hover:text-amber-600 bg-amber-400 hover:bg-amber-300 px-3 py-1 rounded-xl font-medium text-[12px] transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add Members</span>
                  </button>
                </div>

                {teamForm.selectedMemberIds.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto p-2 rounded-xl bg-ivory-light border border-gray-200 space-y-1.5">
                    {teamForm.selectedMemberIds.map((mId) => {
                      const member = churchMembers.find(m => m.id === mId);
                      if (!member) return null;
                      return (
                        <div key={mId} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-indigo-50 shadow-2xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span className="font-medium text-indigo-950 text-xs">{member.first_name} {member.last_name}</span>
                            {member.ministry_name && (
                              <span className="text-[12px] bg-indigo-50 text-indigo-900 font-medium px-1.5 py-0.5 rounded">
                                {member.ministry_name}
                              </span>
                            )}
                          </div>
                          {canManage && (<button
                            type="button"
                            onClick={() => handleRemoveMemberFromForm(mId)}
                            className="text-muted hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
                            title="Remove member"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>)}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div data-guide="duty-team-members"
                    onClick={handleOpenSelectorForForm}
                    className="p-3 rounded-xl border border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/60 cursor-pointer text-center text-[12px] text-muted transition-colors"
                  >
                    No disciples added yet. Click <strong className="text-indigo-950 underline">+ Add Members</strong> to select multiple disciples at once.
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-charcoal/70 mb-1">Duty Tasks / Checklist</label>
                <textarea data-guide="duty-team-tasks"
                  rows={3}
                  value={teamForm.tasks_checklist}
                  onChange={(e) => setTeamForm({ ...teamForm, tasks_checklist: e.target.value })}
                  className="w-full bg-ivory-light p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  placeholder="e.g. Sanctuary Cleaning, Sound Setup, Trash Disposal..."
                ></textarea>
              </div>

              <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-charcoal hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button data-guide="duty-team-save"
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-medium shadow-md cursor-pointer active:scale-95"
                >
                  {editingTeam ? "Save Changes" : "Create Team"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* MODAL 2: Multi-Member Selector Modal (Batch Add Disciples) */}
      {isMultiMemberSelectorOpen && createPortal(
        <div className="fixed inset-0 z-[110] bg-charcoal/70 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div data-modal-header className="flex items-center justify-between pb-3 border-b border-indigo-50 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-indigo-950 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>Select Team Members</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {selectorTarget === "existing_team" && targetTeam
                    ? `Batch add disciples to ${targetTeam.name}`
                    : "Select multiple disciples to assign to this duty team"}
                </p>
              </div>
              <button
                onClick={() => setIsMultiMemberSelectorOpen(false)}
                className="p-1.5 text-muted hover:text-indigo-950 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="space-y-3 shrink-0">
              <FilterPanel title="Disciple filters" summary={selectorSearchQuery || "Search disciples by name and ministry"}>
                <div className="filter-panel-layout grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input data-guide="duty-member-search"
                    type="text"
                    placeholder="Search disciple name..."
                    value={selectorSearchQuery}
                    onChange={(e) => setSelectorSearchQuery(e.target.value)}
                    className="w-full bg-ivory-light pl-9 pr-3 py-2 rounded-xl border border-indigo-100 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div className="relative">
                  <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  <select
                    value={selectorMinistryFilter}
                    onChange={(e) => setSelectorMinistryFilter(e.target.value)}
                    className="w-full bg-ivory-light pl-9 pr-3 py-2 rounded-xl border border-indigo-100 text-xs focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
                  >
                    <option value="">All Ministries ({ministries.length} Ministries)</option>
                    {allMinistries.map((min) => {
                      const count = churchMembers.filter(
                        m => m.ministry_id === min.id || (m.ministry_name && m.ministry_name.toLowerCase() === min.name.toLowerCase())
                      ).length;
                      return (
                        <option key={min.id} value={String(min.id)}>
                          {min.name} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              </FilterPanel>

              {/* Quick Batch Controls & Counter */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-[12px] font-medium text-indigo-950 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer active:scale-95"
                  >
                    Select All Filtered ({filteredSelectorMembers.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-[12px] font-medium text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer active:scale-95"
                  >
                    Clear Selection
                  </button>
                </div>

                <span className="font-medium text-xs text-indigo-950 bg-amber-100 border border-amber-300 px-3 py-0.5 rounded-full shadow-2xs">
                  {selectorSelectedIds.size} Selected
                </span>
              </div>
            </div>

            {/* Member List Grid */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[220px]">
              {filteredSelectorMembers.length > 0 ? (
                filteredSelectorMembers.map((member) => {
                  const isSelected = selectorSelectedIds.has(member.id);
                  const isAlreadyInTeam = selectorTarget === "existing_team" && targetTeam?.members?.some(m => m.member_id === member.id);

                  return (
                    <div
                      key={member.id}
                      onClick={() => handleToggleMemberSelection(member.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${isSelected
                        ? "bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-200/50 shadow-2xs"
                        : "bg-white hover:bg-gray-50/80 border-indigo-100/70"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => { }} // handled by parent onClick
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="w-8 h-8 rounded-full bg-indigo-900 text-amber-300 font-medium text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {member.first_name?.[0] || ""}{member.last_name?.[0] || ""}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-xs text-indigo-950">
                              {member.first_name} {member.last_name}
                            </span>
                            {member.ministry_name && (
                              <span className="text-[12px] font-medium bg-indigo-50 text-indigo-900 border border-indigo-100/80 px-2 py-0.2 rounded-md">
                                {member.ministry_name}
                              </span>
                            )}
                            {isAlreadyInTeam && (
                              <span className="text-[12px] font-medium bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.2 rounded-md">
                                Already in Team
                              </span>
                            )}
                          </div>
                          {member.contact_phone && (
                            <span className="text-[12px] text-muted font-mono">
                              {member.contact_phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs">
                        {isSelected ? (
                          <span className="flex items-center gap-1 font-medium text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded-xl">
                            <Check className="w-3.5 h-3.5" />
                            <span>Selected</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-muted font-medium">Click to select</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 text-xs text-muted">
                  No disciples match the current search / filter criteria.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div data-modal-footer className="pt-3 border-t border-indigo-50 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted">
                <strong>{selectorSelectedIds.size}</strong> disciples chosen
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMultiMemberSelectorOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-xs text-charcoal hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelector}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-medium text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm & Add ({selectorSelectedIds.size}) Disciples</span>
                </button>
              </div>
            </div>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* MODAL 3: Swap Saturday Duty */}
      {isSwapModalOpen && swapItem1 && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div data-modal-header className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-indigo-950 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-indigo-700" />
                <span>Swap Saturday Duty Turns</span>
              </h2>
              <button
                onClick={() => !isSubmittingSwap && setIsSwapModalOpen(false)}
                className="p-1.5 text-muted hover:text-indigo-950 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form data-guide="duty-swap-form" onSubmit={handleExecuteSwap} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1">
                <span className="text-[12px] font-medium uppercase text-indigo-600 block">Currently Selected Turn:</span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-950">{swapItem1.date_formatted}</span>
                  <span className="text-[12px] font-medium text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                    Week {swapItem1.week_number}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: swapItem1.team?.color || "#6366f1" }}
                  ></span>
                  <span className="text-xs text-charcoal font-medium">{swapItem1.team?.name || "Unassigned"}</span>
                  {swapItem1.team?.leader_name && (
                    <span className="text-[12px] text-muted">
                      (Leader: {swapItem1.team.leader_name})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-medium text-indigo-950 mb-1.5">Swap with which upcoming Saturday? *</label>
                <select
                  required
                  value={swapTargetDate}
                  onChange={(e) => setSwapTargetDate(e.target.value)}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-indigo-100 focus:outline-none focus:border-indigo font-medium text-indigo-950 cursor-pointer text-xs"
                >
                  <option value="">-- Choose Saturday to Swap With --</option>
                  {schedule
                    .filter((s) => s.duty_date !== swapItem1.duty_date)
                    .map((s) => (
                      <option key={s.duty_date} value={s.duty_date}>
                        {s.date_formatted} — {s.team?.name || "Unassigned"} (Leader: {s.team?.leader_name || "N/A"})
                      </option>
                    ))}
                </select>
              </div>

              {/* Dynamic Swap Outcome Preview */}
              {(() => {
                const targetItem = schedule.find((s) => s.duty_date === swapTargetDate);
                if (!targetItem || !targetItem.team || !swapItem1.team) return null;
                return (
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 space-y-2.5">
                    <span className="text-[12px] font-medium uppercase text-amber-950 flex items-center gap-1.5">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-amber-700" />
                      <span>Swap Outcome Preview</span>
                    </span>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Box 1 */}
                      <div className="bg-white/95 p-3 rounded-xl border border-amber-200/70 shadow-2xs space-y-1">
                        <span className="text-[12px] text-muted font-medium block">{swapItem1.date_formatted}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: targetItem.team.color }}
                          ></span>
                          <span className="font-medium text-indigo-950 text-xs truncate">
                            {targetItem.team.name}
                          </span>
                        </div>
                        <span className="text-[12px] text-emerald-800 font-medium block">New Assigned Team</span>
                      </div>

                      {/* Box 2 */}
                      <div className="bg-white/95 p-3 rounded-xl border border-amber-200/70 shadow-2xs space-y-1">
                        <span className="text-[12px] text-muted font-medium block">{targetItem.date_formatted}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: swapItem1.team.color }}
                          ></span>
                          <span className="font-medium text-indigo-950 text-xs truncate">
                            {swapItem1.team.name}
                          </span>
                        </div>
                        <span className="text-[12px] text-emerald-800 font-medium block">New Assigned Team</span>
                      </div>
                    </div>

                    <p className="text-[12px] text-muted leading-tight">
                      This will safely swap team turn assignments for these two dates without modifying subsequent recurring cycles.
                    </p>
                  </div>
                );
              })()}

              <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmittingSwap}
                  onClick={() => setIsSwapModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-charcoal hover:bg-gray-200 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSwap || !swapTargetDate}
                  className="px-5 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 disabled:opacity-50 text-white font-medium shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingSwap && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />}
                  <span>{isSubmittingSwap ? "Swapping..." : "Confirm Swap"}</span>
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* MODAL 4: Create / Edit Duty Task */}
      {isDutyTaskModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div data-modal-header className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-indigo-950">
                  {editingDutyTask ? "Edit Cleaning Task" : "Add Cleaning Task"}
                </h2>
                <span className="text-[12px] text-muted">
                  Saturday church building cleaning task
                </span>
              </div>
              <button
                onClick={() => setIsDutyTaskModalOpen(false)}
                className="p-1.5 text-muted hover:text-charcoal hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form data-guide="duty-task-form" onSubmit={handleSaveDutyTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-charcoal mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sanctuary Sweeping & Mopping"
                  value={dutyTaskForm.task}
                  onChange={(e) => setDutyTaskForm({ ...dutyTaskForm, task: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs text-charcoal"
                />
              </div>

              <div>
                <label className="block font-medium text-charcoal mb-1">Description / Specifics</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Clean altar, aisles, pews, and pulpit area."
                  value={dutyTaskForm.desc}
                  onChange={(e) => setDutyTaskForm({ ...dutyTaskForm, desc: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs text-charcoal"
                ></textarea>
              </div>

              <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDutyTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-charcoal hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-white font-medium shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {editingDutyTask ? "Save Changes" : "Add Task"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* MODAL 5: Create / Edit Guideline Card */}
      {isGuidelineModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div data-modal-header className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-indigo-950">
                  {editingGuideline ? "Edit Guideline Card" : "Add Guideline Card"}
                </h2>
                <span className="text-[12px] text-muted">
                  Operational best practices for duty teams
                </span>
              </div>
              <button
                onClick={() => setIsGuidelineModalOpen(false)}
                className="p-1.5 text-muted hover:text-charcoal hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form data-guide="duty-guideline-form" onSubmit={handleSaveGuideline} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-charcoal mb-1">Card Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g.  Call Time & Attendance"
                  value={guidelineForm.title}
                  onChange={(e) => setGuidelineForm({ ...guidelineForm, title: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs text-charcoal"
                />
              </div>

              <div>
                <label className="block font-medium text-charcoal mb-1">Color Theme</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: "amber", label: "Amber", bg: "bg-amber-50 text-amber-800 border-amber-200" },
                    { key: "indigo", label: "Indigo", bg: "bg-indigo-50 text-indigo-800 border-indigo-200" },
                    { key: "emerald", label: "Emerald", bg: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                    { key: "rose", label: "Rose", bg: "bg-rose-50 text-rose-800 border-rose-200" },
                    { key: "teal", label: "Teal", bg: "bg-teal-50 text-teal-800 border-teal-200" },
                    { key: "sky", label: "Sky", bg: "bg-sky-50 text-sky-800 border-sky-200" },
                    { key: "violet", label: "Violet", bg: "bg-violet-50 text-violet-800 border-violet-200" }
                  ].map(theme => (
                    <button
                      key={theme.key}
                      type="button"
                      onClick={() => setGuidelineForm({ ...guidelineForm, color: theme.key as any })}
                      className={`py-1.5 px-2 rounded-xl text-[12px] font-medium border transition-all cursor-pointer ${theme.bg} ${
                        guidelineForm.color === theme.key ? "ring-2 ring-indigo-950 scale-102 shadow-xs" : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-charcoal mb-1">Guideline Details *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. Duty teams convene at the church premises every Saturday by 1:00 PM - 3:00 PM."
                  value={guidelineForm.desc}
                  onChange={(e) => setGuidelineForm({ ...guidelineForm, desc: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs text-charcoal"
                ></textarea>
              </div>

              <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGuidelineModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-charcoal hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-white font-medium shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {editingGuideline ? "Save Changes" : "Add Guideline"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* Reusable Confirmation & Alert Modal */}
      <ConfirmationModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        description={confirmModalConfig.description}
        type={confirmModalConfig.type}
        confirmText={confirmModalConfig.confirmText}
        cancelText={confirmModalConfig.cancelText}
        isLoading={confirmModalConfig.isLoading}
        onConfirm={confirmModalConfig.onConfirm}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

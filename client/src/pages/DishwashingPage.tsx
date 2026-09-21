import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { useSocketEvent } from "../socket";
import { DishwashingPageSkeleton, CardGridSkeleton, TableSkeleton } from "../components/common/SkeletonLoader";
import { DishwashingTeam, SundayDutyScheduleItem, Member, BibleStudyGroup, Ministry } from "../types";
import { ConfirmationModal, ModalType } from "../components/common/ConfirmationModal";
import {
  Utensils, Sparkles, Calendar, CalendarCheck, Users, CheckCircle2, Clock, Plus,
  Trash2, Edit, RefreshCw, ArrowLeftRight, Check, X,
  AlertCircle, ChevronRight, Phone, CheckSquare, Crown, UserPlus,
  BookOpen, Building2, Layers, ShieldCheck, ArrowRight,
  Droplets, Flame, Search, Filter, Sparkle, CalendarDays, Award,
  ListOrdered, HeartHandshake, Eye
} from "lucide-react";

export interface KitchenProtocolCard {
  id: string;
  title: string;
  subtitle: string;
  color: "teal" | "emerald" | "amber" | "rose" | "indigo" | "sky" | "violet";
  items: string[];
}

export interface KitchenChecklistItem {
  id: string;
  task: string;
  completed?: boolean;
}

const DEFAULT_KITCHEN_PROTOCOLS: KitchenProtocolCard[] = [
  {
    id: "proto-1",
    title: "1. Pre-Scraping & Washing Protocol",
    subtitle: "Fellowship cutlery, plates, and bowls handling",
    color: "teal",
    items: [
      "Scrape all leftover food waste into the garbage disposal bin with rubber scrapers.",
      "Pre-rinse plates with warm water spray before loading into Sink 1.",
      "Wash dinnerware in Sink 1 with warm soapy water (110°F+ with food-grade detergent).",
      "Rinse thoroughly in Sink 2 with clear hot running water."
    ]
  },
  {
    id: "proto-2",
    title: "2. Sanitizing & Air-Drying Standard",
    subtitle: "3-Compartment chemical dip & air-drying standard",
    color: "emerald",
    items: [
      "Submerge clean wares in Sink 3 sanitizing solution for at least 60 seconds.",
      "Stack vertically in designated drying racks. Allow 100% air-drying (do not towel dry).",
      "Return dried and sanitized dinnerware to closed kitchen cupboards."
    ]
  },
  {
    id: "proto-3",
    title: "3. Countertops & Appliance Disinfection",
    subtitle: "Fellowship counter, microwave, and coffee maker care",
    color: "amber",
    items: [
      "Wipe all stainless steel food prep surfaces with sanitizing disinfectant spray.",
      "Clean coffee maker carafes, empty coffee grounds, and turn off heating plates.",
      "Wipe microwave interior and exterior handle. Clean food splatter immediately."
    ]
  },
  {
    id: "proto-4",
    title: "4. Trash Disposal & Kitchen Closing",
    subtitle: "Final checks before leaving the fellowship hall",
    color: "rose",
    items: [
      "Tie up all kitchen food waste bags and dispose in outside dumpster.",
      "Line trash bins with fresh heavy-duty garbage bags.",
      "Ensure gas stove knobs and water faucets are securely shut off.",
      "Turn off kitchen lighting and exhaust fans before locking."
    ]
  }
];

const DEFAULT_KITCHEN_CHECKLIST: KitchenChecklistItem[] = [
  { id: "chk-1", task: "Wipe down all food prep countertops & stainless tables with disinfectant spray" },
  { id: "chk-2", task: "Clean food strainers in sinks and pour boiling water down drainage traps" },
  { id: "chk-3", task: "Tie all kitchen garbage bags and transfer them to the outdoor disposal bin" },
  { id: "chk-4", task: "Hang damp dish towels to dry and ensure gas/water main shut-off valves are closed" }
];

const getProtocolTheme = (color: string) => {
  switch (color) {
    case "emerald":
      return {
        bg: "bg-emerald-50",
        border: "border-emerald-100",
        text: "text-emerald-700",
        accent: "text-emerald-600",
        badgeBg: "bg-emerald-600"
      };
    case "amber":
      return {
        bg: "bg-amber-50",
        border: "border-amber-100",
        text: "text-amber-700",
        accent: "text-amber-600",
        badgeBg: "bg-amber-600"
      };
    case "rose":
      return {
        bg: "bg-rose-50",
        border: "border-rose-100",
        text: "text-rose-700",
        accent: "text-rose-600",
        badgeBg: "bg-rose-600"
      };
    case "indigo":
      return {
        bg: "bg-indigo-50",
        border: "border-indigo-100",
        text: "text-indigo-700",
        accent: "text-indigo-600",
        badgeBg: "bg-indigo-600"
      };
    case "sky":
      return {
        bg: "bg-sky-50",
        border: "border-sky-100",
        text: "text-sky-700",
        accent: "text-sky-600",
        badgeBg: "bg-sky-600"
      };
    case "violet":
      return {
        bg: "bg-violet-50",
        border: "border-violet-100",
        text: "text-violet-700",
        accent: "text-violet-600",
        badgeBg: "bg-violet-600"
      };
    case "teal":
    default:
      return {
        bg: "bg-teal-50",
        border: "border-teal-100",
        text: "text-teal-700",
        accent: "text-teal-600",
        badgeBg: "bg-teal-600"
      };
  }
};

export const DishwashingPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrCoordinator = user?.role_name === "Admin" || user?.role_name === "Coordinator";

  const [activeTab, setActiveTab] = useState<"teams" | "schedule" | "tasks">("teams");
  const [teams, setTeams] = useState<DishwashingTeam[]>([]);
  const [schedule, setSchedule] = useState<SundayDutyScheduleItem[]>([]);
  const [churchMembers, setChurchMembers] = useState<Member[]>([]);
  const [bsGroups, setBsGroups] = useState<BibleStudyGroup[]>([]);
  const [ministriesList, setMinistriesList] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);

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
    onConfirm: () => { }
  });

  const showAlert = (title: string, message: string, type: ModalType = "danger") => {
    setConfirmModalConfig({
      isOpen: true,
      title,
      type,
      confirmText: "Okay",
      cancelText: null,
      description: <p className="text-xs text-slate-600 text-center">{message}</p>,
      onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "biblestudy_group" | "ministry" | "custom">("all");

  // Team modal state (Add / Edit Rotating Unit)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<DishwashingTeam | null>(null);
  const [teamForm, setTeamForm] = useState({
    cycle_mode: "biblestudy_group" as "biblestudy_group" | "ministry" | "custom",
    biblestudy_group_id: "",
    ministry_id: "",
    name: "",
    order_seq: 1,
    leader_id: "",
    leader_name: "",
    leader_contact: "",
    color: "#0D9488",
    volunteers_count: 5,
    tasks_checklist: "Plates & Cutleries Pre-rinse, 3-Compartment Washing & Sanitization, Dish Drying & Storage, Kitchen Counter & Sink Deep Wipe, Trash Disposal & Clean Linens",
    selectedMemberIds: [] as number[]
  });

  // Add member modal state
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [targetTeam, setTargetTeam] = useState<DishwashingTeam | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberRole, setMemberRole] = useState<string>("Regular Crew Member");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberTab, setMemberTab] = useState<"group" | "all">("group");
  const [batchLoading, setBatchLoading] = useState(false);

  // Swap modal state
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapItem1, setSwapItem1] = useState<SundayDutyScheduleItem | null>(null);
  const [swapTargetDate, setSwapTargetDate] = useState<string>("");

  // Single Sunday Override modal state ("Mababago lang yan kapag nag edit")
  const [overrideItem, setOverrideItem] = useState<SundayDutyScheduleItem | null>(null);
  const [overrideTeamId, setOverrideTeamId] = useState<string>("");
  const [overrideStatus, setOverrideStatus] = useState<string>("scheduled");
  const [overrideNotes, setOverrideNotes] = useState("");

  // =========================================================================
  // Kitchen Protocols & Checklist Dynamic State
  // =========================================================================
  const [protocols, setProtocols] = useState<KitchenProtocolCard[]>(() => {
    try {
      const saved = localStorage.getItem("dpc_kitchen_protocols");
      return saved ? JSON.parse(saved) : DEFAULT_KITCHEN_PROTOCOLS;
    } catch {
      return DEFAULT_KITCHEN_PROTOCOLS;
    }
  });

  const [closeoutChecklist, setCloseoutChecklist] = useState<KitchenChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem("dpc_kitchen_closeout_checklist");
      return saved ? JSON.parse(saved) : DEFAULT_KITCHEN_CHECKLIST;
    } catch {
      return DEFAULT_KITCHEN_CHECKLIST;
    }
  });

  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<KitchenProtocolCard | null>(null);
  const [protocolForm, setProtocolForm] = useState<{
    title: string;
    subtitle: string;
    color: "teal" | "emerald" | "amber" | "rose" | "indigo" | "sky" | "violet";
    items: string[];
  }>({
    title: "",
    subtitle: "",
    color: "teal",
    items: [""]
  });

  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [editingChecklistItem, setEditingChecklistItem] = useState<KitchenChecklistItem | null>(null);
  const [checklistForm, setChecklistForm] = useState<{ task: string }>({ task: "" });

  const saveProtocols = (newProtocols: KitchenProtocolCard[]) => {
    setProtocols(newProtocols);
    localStorage.setItem("dpc_kitchen_protocols", JSON.stringify(newProtocols));
  };

  const saveCloseoutChecklist = (newChecklist: KitchenChecklistItem[]) => {
    setCloseoutChecklist(newChecklist);
    localStorage.setItem("dpc_kitchen_closeout_checklist", JSON.stringify(newChecklist));
  };

  const handleOpenAddProtocol = () => {
    setEditingProtocol(null);
    setProtocolForm({
      title: "",
      subtitle: "",
      color: "teal",
      items: [""]
    });
    setIsProtocolModalOpen(true);
  };

  const handleOpenEditProtocol = (proto: KitchenProtocolCard) => {
    setEditingProtocol(proto);
    setProtocolForm({
      title: proto.title,
      subtitle: proto.subtitle,
      color: proto.color || "teal",
      items: proto.items && proto.items.length > 0 ? [...proto.items] : [""]
    });
    setIsProtocolModalOpen(true);
  };

  const handleSaveProtocol = (e: React.FormEvent) => {
    e.preventDefault();
    if (!protocolForm.title.trim()) {
      showAlert("Missing Title", "Please enter a protocol title.");
      return;
    }

    const filteredItems = protocolForm.items.map(it => it.trim()).filter(Boolean);
    if (filteredItems.length === 0) {
      showAlert("Missing Steps", "Please add at least one instruction step.");
      return;
    }

    if (editingProtocol) {
      const updated = protocols.map(p =>
        p.id === editingProtocol.id
          ? { ...p, title: protocolForm.title.trim(), subtitle: protocolForm.subtitle.trim(), color: protocolForm.color, items: filteredItems }
          : p
      );
      saveProtocols(updated);
    } else {
      const newProto: KitchenProtocolCard = {
        id: `proto-${Date.now()}`,
        title: protocolForm.title.trim(),
        subtitle: protocolForm.subtitle.trim(),
        color: protocolForm.color,
        items: filteredItems
      };
      saveProtocols([...protocols, newProto]);
    }
    setIsProtocolModalOpen(false);
  };

  const handleDeleteProtocol = (id: string, title: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: "Delete Protocol Card",
      type: "danger",
      confirmText: "Delete Protocol",
      description: (
        <p className="text-xs text-slate-600 text-center">
          Are you sure you want to remove <strong>"{title}"</strong>?
        </p>
      ),
      onConfirm: () => {
        const updated = protocols.filter(p => p.id !== id);
        saveProtocols(updated);
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleOpenAddChecklist = () => {
    setEditingChecklistItem(null);
    setChecklistForm({ task: "" });
    setIsChecklistModalOpen(true);
  };

  const handleOpenEditChecklist = (item: KitchenChecklistItem) => {
    setEditingChecklistItem(item);
    setChecklistForm({ task: item.task });
    setIsChecklistModalOpen(true);
  };

  const handleSaveChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistForm.task.trim()) {
      showAlert("Missing Task", "Please enter task description.");
      return;
    }

    if (editingChecklistItem) {
      const updated = closeoutChecklist.map(c =>
        c.id === editingChecklistItem.id ? { ...c, task: checklistForm.task.trim() } : c
      );
      saveCloseoutChecklist(updated);
    } else {
      const newItem: KitchenChecklistItem = {
        id: `chk-${Date.now()}`,
        task: checklistForm.task.trim(),
        completed: false
      };
      saveCloseoutChecklist([...closeoutChecklist, newItem]);
    }
    setIsChecklistModalOpen(false);
  };

  const handleDeleteChecklistItem = (id: string) => {
    const updated = closeoutChecklist.filter(c => c.id !== id);
    saveCloseoutChecklist(updated);
  };

  const handleToggleChecklistItem = (id: string) => {
    const updated = closeoutChecklist.map(c =>
      c.id === id ? { ...c, completed: !c.completed } : c
    );
    saveCloseoutChecklist(updated);
  };

  const handleResetProtocols = () => {
    setConfirmModalConfig({
      isOpen: true,
      title: "Reset to Default SOPs",
      type: "warning",
      confirmText: "Reset to Defaults",
      description: (
        <p className="text-xs text-slate-600 text-center">
          This will restore all kitchen sanitation protocols and close-out checklist tasks to standard church defaults.
        </p>
      ),
      onConfirm: () => {
        saveProtocols(DEFAULT_KITCHEN_PROTOCOLS);
        saveCloseoutChecklist(DEFAULT_KITCHEN_CHECKLIST);
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };


  useEffect(() => {
    loadDishwashingData();
  }, []);

  // Real-time synchronization
  useSocketEvent("dishwashing:changed", () => {
    loadDishwashingData();
  });
  useSocketEvent("members:changed", () => {
    loadDishwashingData();
  });
  useSocketEvent("groups:changed", () => {
    loadDishwashingData();
  });
  useSocketEvent("ministries:changed", () => {
    loadDishwashingData();
  });

  const loadDishwashingData = async () => {
    try {
      setLoading(true);
      const [teamsData, scheduleData, membersData, groupsData, ministriesData] = await Promise.all([
        api.getDishwashingTeams().catch(() => []),
        api.getDishwashingSchedule({ count: 16 }).catch(() => ({ total_teams: 0, cycle_interval_weeks: 0, thisSunday: null, nextSunday: null, schedule: [] })),
        api.getMembers({ status: "active" }).catch(() => []),
        api.getGroups().catch(() => []),
        api.getMinistries().catch(() => [])
      ]);
      setTeams(teamsData || []);
      setSchedule(scheduleData?.schedule || []);
      setChurchMembers([...(membersData || [])].sort((a, b) => {
        const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
        const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      }));
      setBsGroups(groupsData || []);
      setMinistriesList(ministriesData || []);
    } catch (err) {
      console.error("Failed to load dishwashing roster:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered teams list
  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.leader_name && t.leader_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchMode = filterMode === "all" || t.cycle_mode === filterMode;
      return matchSearch && matchMode;
    });
  }, [teams, searchQuery, filterMode]);

  // Derived rotation milestones
  const thisSunday = schedule[0] || null;
  const nextSunday = schedule[1] || null;
  const thirdSunday = schedule[2] || null;
  const completedCount = schedule.filter(s => s.status === "completed").length;

  // Helper: Match leader string with registered church members
  const findMemberByLeaderName = (leaderName?: string, leaderId?: number | null) => {
    if (leaderId) {
      const found = churchMembers.find(m => m.id === leaderId);
      if (found) return found;
    }
    if (!leaderName) return null;
    const clean = leaderName
      .replace(/^(pastor|ptr\.|ate|kuya|bro\.|brother|sis\.|sister)\s+/i, "")
      .replace(/\(.*?\)/g, "")
      .trim()
      .toLowerCase();

    if (!clean) return null;

    return churchMembers.find(m => {
      const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
      return fullName === clean || fullName.includes(clean) || clean.includes(fullName);
    });
  };

  // Helper: Retrieve all members/disciples belonging to a ministry (by ministry_id, ministry_name, or age bracket)
  const getMinistryMembers = (m?: Ministry | null) => {
    if (!m) return [];
    return churchMembers.filter(cm => {
      if (cm.ministry_id && Number(cm.ministry_id) === Number(m.id)) return true;
      if (cm.ministry_name && m.name && (
        cm.ministry_name.toLowerCase().includes(m.name.toLowerCase()) ||
        m.name.toLowerCase().includes(cm.ministry_name.toLowerCase())
      )) return true;
      if (m.min_age !== undefined && m.max_age !== undefined && m.min_age !== null && m.max_age !== null && cm.birthdate) {
        const birth = new Date(cm.birthdate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
        if (!isNaN(age) && age >= m.min_age && age <= m.max_age) return true;
      }
      return false;
    });
  };

  const handleOpenCreateTeam = () => {
    setEditingTeam(null);
    const nextNum = teams.length + 1;
    const firstGroup = bsGroups[0];
    const matchedLeader = firstGroup ? findMemberByLeaderName(firstGroup.leader_name, firstGroup.leader_id) : null;
    const groupMemberIds = firstGroup?.members?.map(m => m.member_id).filter(Boolean) || [];

    setTeamForm({
      cycle_mode: "biblestudy_group",
      biblestudy_group_id: firstGroup ? String(firstGroup.id) : "",
      ministry_id: "",
      name: firstGroup ? firstGroup.name : `Kitchen Crew ${nextNum}`,
      order_seq: nextNum,
      leader_id: matchedLeader ? String(matchedLeader.id) : "",
      leader_name: matchedLeader ? `${matchedLeader.first_name} ${matchedLeader.last_name}` : (firstGroup?.leader_name || ""),
      leader_contact: matchedLeader
        ? (matchedLeader.contact_phone || matchedLeader.contact_email || firstGroup?.leader_contact || "")
        : (firstGroup?.leader_contact || ""),
      color: ["#0D9488", "#0284C7", "#7C3AED", "#EA580C", "#059669", "#D97706", "#DB2777"][nextNum % 7],
      volunteers_count: Math.max(groupMemberIds.length || 4, 4),
      tasks_checklist: "Plates & Cutleries Pre-rinse, 3-Compartment Washing & Sanitization, Dish Drying & Storage, Kitchen Counter & Sink Deep Wipe, Trash Disposal & Clean Linens",
      selectedMemberIds: groupMemberIds
    });
    setIsTeamModalOpen(true);
  };

  const handleOpenEditTeam = (team: DishwashingTeam) => {
    setEditingTeam(team);
    const linkedGroup = bsGroups.find(g => g.id === team.biblestudy_group_id || g.name === team.name);
    const linkedMinistry = ministriesList.find(m => m.id === team.ministry_id || team.name.toLowerCase().includes(m.name.toLowerCase()));
    const existingMemberIds = team.members?.map(m => m.member_id) || [];
    const groupMemberIds = linkedGroup?.members?.map(m => m.member_id).filter(Boolean) || [];
    const ministryMembers = getMinistryMembers(linkedMinistry);
    const ministryMemberIds = ministryMembers.map(cm => cm.id);
    const coveredMemberIds = linkedGroup ? groupMemberIds : (linkedMinistry ? ministryMemberIds : []);
    const combinedMemberIds = Array.from(new Set([...existingMemberIds, ...coveredMemberIds]));
    const matchedLeader = findMemberByLeaderName(team.leader_name, team.leader_id);

    setTeamForm({
      cycle_mode: team.cycle_mode || (linkedMinistry ? "ministry" : (linkedGroup ? "biblestudy_group" : "custom")),
      biblestudy_group_id: team.biblestudy_group_id ? String(team.biblestudy_group_id) : (linkedGroup ? String(linkedGroup.id) : ""),
      ministry_id: team.ministry_id ? String(team.ministry_id) : (linkedMinistry ? String(linkedMinistry.id) : ""),
      name: team.name,
      order_seq: team.order_seq,
      leader_id: team.leader_id ? String(team.leader_id) : (matchedLeader ? String(matchedLeader.id) : ""),
      leader_name: team.leader_name || (matchedLeader ? `${matchedLeader.first_name} ${matchedLeader.last_name}` : ""),
      leader_contact: team.leader_contact || team.leader_phone || (matchedLeader?.contact_phone || matchedLeader?.contact_email || ""),
      color: team.color || linkedMinistry?.color || "#0D9488",
      volunteers_count: team.volunteers_count || Math.max(combinedMemberIds.length, 4),
      tasks_checklist: team.tasks_checklist || "Plates & Cutleries Pre-rinse, 3-Compartment Washing & Sanitization, Dish Drying & Storage, Kitchen Counter & Sink Deep Wipe, Trash Disposal & Clean Linens",
      selectedMemberIds: combinedMemberIds.length > 0 ? combinedMemberIds : existingMemberIds
    });
    setIsTeamModalOpen(true);
  };

  const handleCycleModeChange = (mode: "biblestudy_group" | "ministry" | "custom") => {
    if (mode === "biblestudy_group") {
      const g = bsGroups[0];
      const matchedLeader = g ? findMemberByLeaderName(g.leader_name, g.leader_id) : null;
      const groupMemberIds = g?.members?.map(m => m.member_id).filter(Boolean) || [];

      setTeamForm(prev => ({
        ...prev,
        cycle_mode: "biblestudy_group",
        biblestudy_group_id: g ? String(g.id) : "",
        ministry_id: "",
        name: g ? g.name : prev.name,
        leader_id: matchedLeader ? String(matchedLeader.id) : "",
        leader_name: matchedLeader ? `${matchedLeader.first_name} ${matchedLeader.last_name}` : (g?.leader_name || ""),
        leader_contact: matchedLeader
          ? (matchedLeader.contact_phone || matchedLeader.contact_email || g?.leader_contact || "")
          : (g?.leader_contact || ""),
        selectedMemberIds: groupMemberIds,
        volunteers_count: Math.max(groupMemberIds.length, 4)
      }));
    } else if (mode === "ministry") {
      const m = ministriesList[0];
      const coordName = m?.coordinators?.[0]?.name;
      const matchedLeader = coordName ? findMemberByLeaderName(coordName) : null;
      const ministryMembers = getMinistryMembers(m);
      const ministryMemberIds = ministryMembers.map(cm => cm.id);

      setTeamForm(prev => ({
        ...prev,
        cycle_mode: "ministry",
        biblestudy_group_id: "",
        ministry_id: m ? String(m.id) : "",
        name: m ? `${m.name} Ministry` : prev.name,
        color: m?.color || prev.color,
        leader_id: matchedLeader ? String(matchedLeader.id) : "",
        leader_name: matchedLeader ? `${matchedLeader.first_name} ${matchedLeader.last_name}` : (coordName || ""),
        leader_contact: matchedLeader ? (matchedLeader.contact_phone || matchedLeader.contact_email || "") : "",
        selectedMemberIds: ministryMemberIds,
        volunteers_count: Math.max(ministryMemberIds.length, 4)
      }));
    } else {
      setTeamForm(prev => ({
        ...prev,
        cycle_mode: "custom",
        biblestudy_group_id: "",
        ministry_id: "",
        selectedMemberIds: []
      }));
    }
  };

  const handleSelectGroup = (groupIdStr: string) => {
    const g = bsGroups.find(x => String(x.id) === groupIdStr);
    const matchedLeader = g ? findMemberByLeaderName(g.leader_name, g.leader_id) : null;
    const groupMemberIds = g?.members?.map(m => m.member_id).filter(Boolean) || [];

    setTeamForm(prev => ({
      ...prev,
      biblestudy_group_id: groupIdStr,
      name: g ? g.name : prev.name,
      leader_id: matchedLeader ? String(matchedLeader.id) : (prev.leader_id || ""),
      leader_name: matchedLeader ? `${matchedLeader.first_name} ${matchedLeader.last_name}` : (g?.leader_name || prev.leader_name),
      leader_contact: matchedLeader
        ? (matchedLeader.contact_phone || matchedLeader.contact_email || g?.leader_contact || "")
        : (g?.leader_contact || prev.leader_contact),
      selectedMemberIds: groupMemberIds,
      volunteers_count: Math.max(groupMemberIds.length, 4)
    }));
  };

  const handleSelectPointPerson = (selId: string) => {
    if (!selId) {
      setTeamForm(prev => ({
        ...prev,
        leader_id: "",
        leader_name: "",
        leader_contact: ""
      }));
      return;
    }

    const m = churchMembers.find(x => String(x.id) === selId);
    if (!m) return;

    // Find if this leader has an assigned Bible Study Group
    const matchedGroup = bsGroups.find(g => {
      if (g.leader_id && Number(g.leader_id) === Number(selId)) return true;
      if (!g.leader_name) return false;
      const cleanGLeader = g.leader_name.toLowerCase().replace(/^(pastor|ptr\.|pt\.|ate|kuya|bro\.|brother|sis\.|sister)\s+/i, "").trim();
      const memFullName = `${m.first_name} ${m.last_name}`.toLowerCase();
      return cleanGLeader.includes(m.first_name.toLowerCase()) || memFullName.includes(cleanGLeader);
    });

    const groupMemberIds = matchedGroup?.members?.map(gm => gm.member_id).filter(Boolean) || [];

    setTeamForm(prev => {
      const shouldUpdateGroup = prev.cycle_mode === "biblestudy_group" && matchedGroup;
      const newSelected = groupMemberIds.length > 0 ? groupMemberIds : prev.selectedMemberIds;
      return {
        ...prev,
        leader_id: selId,
        leader_name: `${m.first_name} ${m.last_name}`,
        leader_contact: m.contact_phone || m.contact_email || matchedGroup?.leader_contact || prev.leader_contact,
        biblestudy_group_id: shouldUpdateGroup ? String(matchedGroup.id) : prev.biblestudy_group_id,
        name: shouldUpdateGroup ? matchedGroup.name : prev.name,
        selectedMemberIds: newSelected,
        volunteers_count: groupMemberIds.length > 0 ? Math.max(groupMemberIds.length, 4) : prev.volunteers_count
      };
    });
  };

  const handleSelectMinistry = (minIdStr: string) => {
    const m = ministriesList.find(x => String(x.id) === minIdStr);
    const coordName = m?.coordinators?.[0]?.name;
    const matchedLeader = coordName ? findMemberByLeaderName(coordName) : null;
    const ministryMembers = getMinistryMembers(m);
    const ministryMemberIds = ministryMembers.map(cm => cm.id);

    setTeamForm(prev => ({
      ...prev,
      ministry_id: minIdStr,
      name: m ? `${m.name} Ministry` : prev.name,
      color: m?.color || prev.color,
      leader_id: matchedLeader ? String(matchedLeader.id) : "",
      leader_name: matchedLeader ? `${matchedLeader.first_name} ${matchedLeader.last_name}` : (coordName || prev.leader_name),
      leader_contact: matchedLeader ? (matchedLeader.contact_phone || matchedLeader.contact_email || "") : prev.leader_contact,
      selectedMemberIds: ministryMemberIds,
      volunteers_count: Math.max(ministryMemberIds.length, 4)
    }));
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamForm.name.trim()) {
      showAlert("Team Name Required", "Please enter a dishwashing team or unit name.", "warning");
      return;
    }

    const dup = teams.find(t =>
      t.name.toLowerCase().trim() === teamForm.name.toLowerCase().trim() &&
      t.id !== editingTeam?.id
    );
    if (dup) {
      showAlert("Duplicate Team Name", `A dishwashing unit named "${teamForm.name.trim()}" already exists in the rotation cycle.`, "warning");
      return;
    }

    if (!teamForm.order_seq || Number(teamForm.order_seq) < 1) {
      showAlert("Invalid Order Sequence", "Order sequence must be at least 1.", "warning");
      return;
    }

    try {
      const payload = {
        name: teamForm.name.trim(),
        cycle_mode: teamForm.cycle_mode,
        biblestudy_group_id: teamForm.biblestudy_group_id ? Number(teamForm.biblestudy_group_id) : null,
        ministry_id: teamForm.ministry_id ? Number(teamForm.ministry_id) : null,
        order_seq: Number(teamForm.order_seq),
        leader_id: teamForm.leader_id ? Number(teamForm.leader_id) : null,
        leader_name: teamForm.leader_name ? teamForm.leader_name.trim() : null,
        leader_contact: teamForm.leader_contact ? teamForm.leader_contact.trim() : null,
        color: teamForm.color,
        volunteers_count: Number(teamForm.volunteers_count) || 4,
        tasks_checklist: teamForm.tasks_checklist ? teamForm.tasks_checklist.trim() : "",
        member_ids: teamForm.selectedMemberIds
      };

      if (editingTeam) {
        await api.updateDishwashingTeam(editingTeam.id, payload);
      } else {
        await api.createDishwashingTeam(payload);
      }
      setIsTeamModalOpen(false);
      loadDishwashingData();
    } catch (err: any) {
      showAlert("Save Failed", err.message || "Failed to save dishwashing team", "danger");
    }
  };

  const handleDeleteTeam = (teamId: number, name: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: "Remove Dishwashing Unit",
      type: "delete",
      confirmText: "Yes, Remove Unit",
      cancelText: "Cancel",
      description: (
        <p className="text-xs text-slate-600 text-center">
          Are you sure you want to remove <strong>"{name}"</strong> from the Sunday rotation cycle?
        </p>
      ),
      onConfirm: async () => {
        try {
          setConfirmModalConfig(prev => ({ ...prev, isLoading: true }));
          await api.deleteDishwashingTeam(teamId);
          loadDishwashingData();
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          showAlert("Delete Failed", err.message || "Failed to delete team", "danger");
        }
      }
    });
  };

  const handleOpenAddMember = (team: DishwashingTeam) => {
    setTargetTeam(team);
    setSelectedMemberId("");
    setMemberRole("Regular Crew Member");
    setMemberSearchQuery("");

    // Identify linked BS group and Ministry, and check for unassigned disciples
    const linkedGroup = bsGroups.find(g => g.id === team.biblestudy_group_id || g.name === team.name);
    const linkedMinistry = ministriesList.find(m => m.id === team.ministry_id || team.name.toLowerCase().includes(m.name.toLowerCase()));
    const existingIds = new Set(team.members?.map(m => m.member_id) || []);

    const unassignedGroupCount = (linkedGroup?.members || []).filter(m => !existingIds.has(m.member_id)).length;
    const ministryMembers = getMinistryMembers(linkedMinistry);
    const unassignedMinCount = ministryMembers.filter(m => !existingIds.has(m.id)).length;

    const hasCoveredEntity = (linkedGroup && unassignedGroupCount > 0) || (linkedMinistry && unassignedMinCount > 0);
    setMemberTab(hasCoveredEntity ? "group" : "all");
    setIsAddMemberModalOpen(true);
  };

  const handleBatchAddGroupDisciples = async (teamId: number, memberIds: number[]) => {
    if (memberIds.length === 0) return;
    try {
      setBatchLoading(true);
      await api.batchAddDishwashingTeamMembers(teamId, { member_ids: memberIds, role: "Member" });
      setIsAddMemberModalOpen(false);
      loadDishwashingData();
      showAlert("Disciples Imported", `Successfully imported ${memberIds.length} disciples from the Bible study group into the dishwashing roster!`, "success");
    } catch (err: any) {
      showAlert("Failed to Add Disciples", err.message || "Failed to batch add disciples", "danger");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleAddMemberToTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTeam || !selectedMemberId) return;
    try {
      await api.addDishwashingTeamMember(targetTeam.id, {
        member_id: Number(selectedMemberId),
        role: memberRole
      });
      setIsAddMemberModalOpen(false);
      loadDishwashingData();
    } catch (err: any) {
      showAlert("Failed to Add Member", err.message || "Failed to add member to team", "danger");
    }
  };

  const handleRemoveMember = (teamId: number, memberId: number, memberName: string) => {
    setConfirmModalConfig({
      isOpen: true,
      title: "Remove Roster Member",
      type: "warning",
      confirmText: "Remove",
      cancelText: "Cancel",
      description: (
        <p className="text-xs text-slate-600 text-center">
          Remove <strong>"{memberName}"</strong> from this dishwashing team?
        </p>
      ),
      onConfirm: async () => {
        try {
          setConfirmModalConfig(prev => ({ ...prev, isLoading: true }));
          await api.removeDishwashingTeamMember(teamId, memberId);
          loadDishwashingData();
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          showAlert("Remove Failed", err.message || "Failed to remove member", "danger");
        }
      }
    });
  };

  const handleOpenSwapModal = (item: SundayDutyScheduleItem) => {
    setSwapItem1(item);
    const otherSundays = schedule.filter(s => s.duty_date !== item.duty_date && s.team);
    setSwapTargetDate(otherSundays[0]?.duty_date || "");
    setIsSwapModalOpen(true);
  };

  const handleExecuteSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapItem1 || !swapItem1.team || !swapTargetDate) return;

    const targetItem = schedule.find(s => s.duty_date === swapTargetDate);
    if (!targetItem || !targetItem.team) {
      showAlert("Invalid Target", "Please select a valid target Sunday with an assigned team", "warning");
      return;
    }

    try {
      await api.swapSundayDishwashingDuty({
        date1: swapItem1.duty_date,
        teamId1: swapItem1.team.id,
        date2: targetItem.duty_date,
        teamId2: targetItem.team.id
      });
      setIsSwapModalOpen(false);
      loadDishwashingData();
    } catch (err: any) {
      showAlert("Swap Failed", err.message || "Failed to swap dishwashing turns", "danger");
    }
  };

  const handleOpenOverrideModal = (item: SundayDutyScheduleItem) => {
    setOverrideItem(item);
    setOverrideTeamId(item.team ? String(item.team.id) : (teams[0] ? String(teams[0].id) : ""));
    setOverrideStatus(item.status || "scheduled");
    setOverrideNotes(item.notes || "");
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideItem || !overrideTeamId) return;
    try {
      await api.overrideSundayDishwashingDuty({
        duty_date: overrideItem.duty_date,
        team_id: Number(overrideTeamId),
        status: overrideStatus,
        notes: overrideNotes
      });
      setOverrideItem(null);
      loadDishwashingData();
    } catch (err: any) {
      showAlert("Override Failed", err.message || "Failed to override Sunday assignment", "danger");
    }
  };

  if (loading && teams.length === 0) {
    return <DishwashingPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* TOP HEADER: Culinary Fellowship Command */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <img
          src="/container_bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35 mix-blend-screen pointer-events-none"
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-black uppercase tracking-wider backdrop-blur-md">
              <Utensils className="w-3.5 h-3.5 text-amber-300" />
              <span>Rotating Service Cycle</span>
            </div>
            <span className="text-xs bg-white/10 border border-white/15 text-slate-200 font-bold px-3 py-1 rounded-full backdrop-blur-md">
              {teams.length} Teams in Loop
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Sunday Dishwashing & Kitchen Care
          </h1>
          <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
            Automated weekly post-fellowship dishwashing cycle across Bible Study Groups and Church Ministries.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={loadDishwashingData}
            className="p-2.5 rounded-2xl border border-white/15 bg-white/10 hover:bg-white/20 text-white transition-all shadow-2xs backdrop-blur-md cursor-pointer active:scale-95"
            title="Refresh schedule"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-300" : ""}`} />
          </button>
          {isAdminOrCoordinator && (
            <button
              onClick={handleOpenCreateTeam}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs px-5 py-2.5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 text-indigo-950" />
              <span>Add Team to Cycle</span>
            </button>
          )}
        </div>
      </div>

      {/* QUICK STATS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
            <ListOrdered className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Rotating Units</span>
            <span className="text-lg font-black text-slate-800">{teams.length} Teams in Loop</span>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Turn Repeat</span>
            <span className="text-lg font-black text-slate-800">Every {teams.length || 1} Weeks</span>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Completed Cleanups</span>
            <span className="text-lg font-black text-slate-800">{completedCount} Verified</span>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">This Sunday</span>
            <span className="text-sm font-black text-slate-800 truncate block max-w-[140px]">
              {thisSunday?.team?.name || "Pending Assign"}
            </span>
          </div>
        </div>
      </div>

      {/* DUAL SHOWCASE HERO: [THIS SUNDAY SPOTLIGHT (7 cols)] + [UPCOMING ROTATION FORECAST CONTAINER (5 cols)] */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT CONTAINER: THIS SUNDAY SPOTLIGHT */}
        <div className="lg:col-span-7 relative overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl border border-teal-800/40 flex flex-col justify-between space-y-5">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-teal-500/15 pointer-events-none rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 w-52 h-52 bg-emerald-500/10 pointer-events-none rounded-full blur-2xl"></div>

          <div className="relative z-10 space-y-4">
            {/* Header Badge Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm animate-pulse">
                  <Droplets className="w-3.5 h-3.5 text-slate-950" />
                  <span>THIS SUNDAY ON DISHWASHING</span>
                </span>
                {thisSunday && (
                  <span className="text-xs text-teal-100 font-bold bg-white/10 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                    {thisSunday.date_formatted}
                  </span>
                )}
              </div>

              {thisSunday?.status === "completed" && (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Sanitation Done</span>
                </span>
              )}
            </div>

            {/* Main Team Info */}
            {thisSunday?.team ? (
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {thisSunday.team.name}
                  </h2>
                  <span
                    className="w-3.5 h-3.5 rounded-full ring-2 ring-white/60 shadow-md inline-block"
                    style={{ backgroundColor: thisSunday.team.color }}
                  ></span>
                  {thisSunday.team.cycle_mode === "biblestudy_group" && (
                    <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      <span>Bible Study Group</span>
                    </span>
                  )}
                  {thisSunday.team.cycle_mode === "ministry" && (
                    <span className="text-[10px] bg-teal-500/30 text-teal-200 border border-teal-400/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      <span>Ministry Unit</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-teal-100/85 mt-2 leading-relaxed max-w-xl">
                  {thisSunday.notes || thisSunday.team.tasks_checklist || "Fellowship dinnerware pre-rinse, sudsy washing, sanitizing dip, drying rack storage & kitchen counter wipedown."}
                </p>

                {/* Point Person & Volunteers row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex items-center gap-2.5">
                    <Crown className="w-4 h-4 text-amber-300 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-teal-200/70 block uppercase font-bold">Crew Leader / Contact</span>
                      <span className="text-xs font-black text-white truncate block">
                        {thisSunday.team.leader_name || "Assigned Point Person"}
                      </span>
                      {(thisSunday.team.leader_contact || thisSunday.team.leader_phone) && (
                        <span className="text-[10px] text-teal-300 font-mono block">
                          {thisSunday.team.leader_contact || thisSunday.team.leader_phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-emerald-300 shrink-0" />
                    <div>
                      <span className="text-[10px] text-teal-200/70 block uppercase font-bold">Volunteer Crew</span>
                      <span className="text-xs font-black text-white">
                        {thisSunday.team.members?.length || thisSunday.team.members_count || thisSunday.team.volunteers_count || 5} Members Assigned
                      </span>
                      <span className="text-[10px] text-emerald-300 block">Ready for fellowship duty</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-teal-200/60 text-xs">
                No dishwashing team active for this Sunday.
              </div>
            )}
          </div>

          {/* Action Row */}
          {thisSunday?.team && (
            <div className="relative z-10 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="text-xs text-teal-200 font-bold bg-white/10 border border-white/20 px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs backdrop-blur-xs">
                  <Sparkles className="w-4 h-4 text-teal-300" />
                  <span>Active Live Cycle • {thisSunday.date_formatted}</span>
                </div>

                <button
                  onClick={() => handleOpenSwapModal(thisSunday)}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs py-2 px-3.5 rounded-xl border border-white/15 transition-all active:scale-95 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-teal-300" />
                  <span>Swap Turn</span>
                </button>
              </div>

              {thisSunday.team.members && thisSunday.team.members.length > 0 && (
                <div className="flex items-center -space-x-1.5 overflow-hidden">
                  {thisSunday.team.members.slice(0, 4).map((m, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full bg-teal-800 border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-white"
                      title={`${m.first_name} ${m.last_name}`}
                    >
                      {m.first_name.charAt(0)}
                    </div>
                  ))}
                  {thisSunday.team.members.length > 4 && (
                    <div className="w-7 h-7 rounded-full bg-teal-900 border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-teal-200">
                      +{thisSunday.team.members.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT CONTAINER: UPCOMING ROTATION FORECAST CONTAINER */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 via-teal-50/40 to-emerald-50/30 rounded-3xl p-6 border border-teal-200/70 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-teal-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-teal-100 text-teal-800">
                  <Calendar className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Upcoming Rotation Queue</h3>
                  <span className="text-[11px] text-slate-500">Next scheduled kitchen steward units</span>
                </div>
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300">
                16-Wk Forecast
              </span>
            </div>

            {/* Next Sunday Card */}
            {nextSunday ? (
              <div className="mt-4 p-4 rounded-2xl bg-white border border-teal-200/80 shadow-2xs space-y-2.5 relative overflow-hidden group hover:border-teal-400 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                    NEXT SUNDAY • {nextSunday.date_formatted}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">Week #{nextSunday.week_number}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-100"
                      style={{ backgroundColor: nextSunday.team?.color || "#0D9488" }}
                    ></span>
                    <div>
                      <h4 className="font-black text-sm text-slate-900">{nextSunday.team?.name || "Unassigned"}</h4>
                      <span className="text-[11px] text-slate-500">
                        Lead: <strong className="text-slate-700">{nextSunday.team?.leader_name || "Team Leader"}</strong>
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenSwapModal(nextSunday)}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-teal-50 text-slate-400 hover:text-teal-700 transition-colors cursor-pointer"
                    title="Swap this upcoming date"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">No next Sunday data</div>
            )}

            {/* Third Sunday Card (On Deck) */}
            {thirdSunday && (
              <div className="mt-2.5 p-3.5 rounded-2xl bg-white/70 border border-slate-200/80 shadow-2xs flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: thirdSunday.team?.color || "#64748B" }}
                  ></span>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      ON DECK • {thirdSunday.date_formatted}
                    </span>
                    <span className="font-black text-slate-800">{thirdSunday.team?.name}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Turn #{thirdSunday.team?.order_seq || 3}
                </span>
              </div>
            )}
          </div>

          {/* Quick Rotation Indicator */}
          <div className="pt-3 border-t border-teal-100 flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1.5 text-teal-800">
              <Sparkle className="w-3.5 h-3.5 text-teal-600" />
              <span>Full 16-Week Schedule is Active</span>
            </span>
            <button
              onClick={() => setActiveTab("schedule")}
              className="text-teal-700 hover:text-teal-900 font-black text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View Timeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & TAB CONTROLS BAR */}
      <div className="bg-white/95 rounded-3xl p-3 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTab("teams")}
            className={`flex items-center gap-2 text-xs font-black px-4 py-2.5 rounded-2xl transition-all cursor-pointer ${activeTab === "teams"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
          >
            <Users className="w-4 h-4" />
            <span>Duty Units & Teams ({teams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex items-center gap-2 text-xs font-black px-4 py-2.5 rounded-2xl transition-all cursor-pointer ${activeTab === "schedule"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>16-Week Rotation Timeline ({schedule.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 text-xs font-black px-4 py-2.5 rounded-2xl transition-all cursor-pointer ${activeTab === "tasks"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Kitchen Sanitation Protocol</span>
          </button>
        </div>

        {/* Filter & Search Bar (Active in Teams Tab) */}
        {activeTab === "teams" && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search unit or leader..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 w-44 sm:w-56 font-medium"
              />
            </div>

            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 font-bold text-slate-700 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="biblestudy_group">Bible Study Groups</option>
              <option value="ministry">Ministries</option>
              <option value="custom">Custom Teams</option>
            </select>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DISHWASHING UNITS & TEAMS MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === "teams" && (
        <div className="space-y-4">
          {loading && teams.length === 0 ? (
            <CardGridSkeleton count={6} columns={3} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeams.map((team) => (
                <div
                  key={team.id}
                  className="bg-white rounded-3xl border border-slate-200/90 hover:border-teal-400 shadow-sm hover:shadow-md transition-all p-5 sm:p-6 flex flex-col justify-between space-y-4 relative overflow-hidden group"
                >
                  {/* Top Color Accent Line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: team.color }}
                  ></div>

                  <div>
                    {/* Team Header */}
                    <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full ring-2 ring-slate-100 shadow-inner"
                          style={{ backgroundColor: team.color }}
                        ></span>
                        <div>
                          <h3 className="font-black text-base text-slate-900 group-hover:text-teal-700 transition-colors">
                            {team.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-teal-900 font-black bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                              Turn #{team.order_seq} in Loop
                            </span>
                            {team.cycle_mode === "biblestudy_group" && (
                              <span className="text-[10px] text-indigo-900 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1">
                                <BookOpen className="w-2.5 h-2.5" />
                                <span>BS Group</span>
                              </span>
                            )}
                            {team.cycle_mode === "ministry" && (
                              <span className="text-[10px] text-emerald-900 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                                <Building2 className="w-2.5 h-2.5" />
                                <span>Ministry</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditTeam(team)}
                          className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Edit Unit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(team.id, team.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Remove Unit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Point Person Info */}
                    <div className="mt-3.5 bg-slate-50/90 p-3 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Point Person / Leader</span>
                          <span className="font-black text-slate-800">{team.leader_name || "Unassigned"}</span>
                        </div>
                      </div>
                      {(team.leader_contact || team.leader_phone) && (
                        <span className="text-[10px] text-teal-800 font-mono font-bold">
                          {team.leader_contact || team.leader_phone}
                        </span>
                      )}
                    </div>

                    {/* Volunteer Roster */}
                    {(() => {
                      const linkedGroup = bsGroups.find(g => g.id === team.biblestudy_group_id || g.name === team.name);
                      const linkedMinistry = ministriesList.find(m => m.id === team.ministry_id || team.name.toLowerCase().includes(m.name.toLowerCase()));

                      const explicitMembers = team.members || [];
                      const existingIds = new Set(explicitMembers.map(m => m.member_id));

                      const autoGroupMembers = (linkedGroup?.members || []).map(gm => {
                        const cm = gm.member_id ? churchMembers.find(c => c.id === gm.member_id) : null;
                        return {
                          member_id: (gm.member_id || gm.id) as number,
                          first_name: cm?.first_name || gm.display_name?.split(" ")[0] || gm.member_name?.split(" ")[0] || "Member",
                          last_name: cm?.last_name || gm.display_name?.split(" ").slice(1).join(" ") || gm.member_name?.split(" ").slice(1).join(" ") || "",
                          team_role: Number(gm.member_id) === Number(team.leader_id) ? "Team Leader" : "Member"
                        };
                      });

                      const autoMinMembers = getMinistryMembers(linkedMinistry).map(cm => ({
                        member_id: cm.id,
                        first_name: cm.first_name,
                        last_name: cm.last_name,
                        team_role: Number(cm.id) === Number(team.leader_id) ? "Team Leader" : "Member"
                      }));

                      const autoMembers = linkedGroup ? autoGroupMembers : (linkedMinistry ? autoMinMembers : []);
                      const displayMembers = [...explicitMembers];
                      for (const am of autoMembers) {
                        if (am.member_id && !existingIds.has(am.member_id)) {
                          displayMembers.push(am as any);
                          existingIds.add(am.member_id);
                        }
                      }
                      displayMembers.sort((a, b) => {
                        if (a.team_role === "Team Leader" && b.team_role !== "Team Leader") return -1;
                        if (b.team_role === "Team Leader" && a.team_role !== "Team Leader") return 1;
                        const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
                        const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
                        return nameA.localeCompare(nameB);
                      });

                      return (
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs font-black text-slate-800 flex-wrap gap-1">
                            <span>Members ({displayMembers.length})</span>
                            <button
                              onClick={() => handleOpenAddMember(team)}
                              className="text-teal-700 hover:text-teal-900 text-[11px] flex items-center gap-1 font-black cursor-pointer transition-colors"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add Member</span>
                            </button>
                          </div>

                          {displayMembers.length > 0 ? (
                            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                              {displayMembers.map((m) => (
                                <div
                                  key={m.member_id}
                                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 hover:bg-slate-100 border border-slate-100 text-xs transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                                    <span className="font-bold text-slate-800">
                                      {m.first_name} {m.last_name}
                                    </span>
                                    {m.team_role === "Team Leader" && (
                                      <span className="text-[9px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.2 rounded-md border border-amber-300">
                                        Lead
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => handleRemoveMember(team.id, m.member_id, `${m.first_name} ${m.last_name}`)}
                                    className="p-1 text-slate-300 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                    title="Remove from unit"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                              No members assigned yet.
                              <button
                                onClick={() => handleOpenAddMember(team)}
                                className="block mx-auto mt-1 text-teal-700 font-bold underline cursor-pointer"
                              >
                                + Add first member
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Tasks Preview */}
                  <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 line-clamp-2">
                    <span className="font-bold text-slate-700">Checklist:</span>{" "}
                    {team.tasks_checklist || "Plates & Cutleries Pre-rinse, 3-Compartment Washing, Kitchen Counter & Sink Deep Wipe, Trash Disposal."}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredTeams.length === 0 && !loading && (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
              <Utensils className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-black text-slate-900 text-base">No Matching Dishwashing Units</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery || filterMode !== "all"
                  ? "Try resetting your search filter to see all active rotating teams."
                  : "Add Bible Study Groups, Ministries, or Custom Teams to start the automatic Sunday duty cycle."}
              </p>
              <button
                onClick={handleOpenCreateTeam}
                className="mt-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-5 py-2.5 rounded-2xl shadow-sm cursor-pointer"
              >
                + Add First Dishwashing Team
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 16-WEEK PERPETUAL ROTATION SCHEDULE TIMELINE */}
      {/* ========================================================================= */}
      {activeTab === "schedule" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-teal-600" />
                <span>16-Week Continuous Sunday Rotation Roster</span>
              </h2>
              <p className="text-xs text-slate-500">
                Teams cycle seamlessly every Sunday based on their turn sequence. Individual dates can be swapped or edited without altering other weeks.
              </p>
            </div>
            <span className="text-xs font-black text-teal-900 bg-teal-50 border border-teal-200 px-3.5 py-1 rounded-full">
              Loop Interval: {teams.length} Weeks
            </span>
          </div>

          <div className="space-y-3">
            {schedule.map((item, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${item.is_this_sunday
                  ? "bg-gradient-to-r from-teal-50/90 via-white to-emerald-50/40 border-teal-400 shadow-sm ring-2 ring-teal-400/20"
                  : item.status === "completed"
                    ? "bg-emerald-50/40 border-emerald-200/80"
                    : item.status === "swapped"
                      ? "bg-amber-50/40 border-amber-200/80"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center gap-4">
                  {/* Date & Week badge */}
                  <div className="w-32 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Week {item.week_number}
                    </span>
                    <span className="text-xs font-black text-slate-900 block">
                      {item.date_formatted}
                    </span>
                    {item.is_this_sunday && (
                      <span className="text-[9px] bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-black px-2 py-0.2 rounded-full uppercase tracking-wide inline-block mt-0.5 shadow-2xs">
                        This Sunday
                      </span>
                    )}
                    {item.is_next_sunday && (
                      <span className="text-[9px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.2 rounded-full uppercase tracking-wide inline-block mt-0.5">
                        Next Sunday
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
                          <h4 className="font-black text-sm text-slate-900">{item.team.name}</h4>
                          <span className="text-[10px] text-slate-400 font-bold">
                            ({item.team.members?.length || item.team.members_count || item.team.volunteers_count || 5} Volunteers)
                          </span>
                          {item.team.cycle_mode === "biblestudy_group" && (
                            <span className="text-[9px] bg-indigo-50 text-indigo-900 font-bold px-1.5 py-0.2 rounded border border-indigo-100">
                              BS Group
                            </span>
                          )}
                          {item.team.cycle_mode === "ministry" && (
                            <span className="text-[9px] bg-teal-50 text-teal-900 font-bold px-1.5 py-0.2 rounded border border-teal-100">
                              Ministry
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-600">
                          Leader: <strong className="text-slate-800 font-bold">{item.team.leader_name || "Assigned"}</strong>
                          {(item.team.leader_contact || item.team.leader_phone) && ` • ${item.team.leader_contact || item.team.leader_phone}`}
                        </span>
                        {item.notes && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">
                            Note: {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-rose-600 font-bold">No unit assigned</span>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {item.is_this_sunday ? (
                    <span className="bg-teal-100 text-teal-950 text-xs font-black px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 border border-teal-300 shadow-2xs">
                      <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                      <span>On Duty This Sunday</span>
                    </span>
                  ) : item.is_next_sunday ? (
                    <span className="bg-indigo-50 text-indigo-950 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-indigo-200">
                      <Clock className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Next in Turn</span>
                    </span>
                  ) : (
                    <span className="bg-slate-50 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200">
                      Turn #{item.team?.order_seq || item.week_number}
                    </span>
                  )}

                  <button
                    onClick={() => handleOpenSwapModal(item)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                    title="Swap with another Sunday"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleOpenOverrideModal(item)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                    title="Edit/Override single date"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SANITATION PROTOCOL & KITCHEN SOPs (DYNAMIC & EDITABLE) */}
      {/* ========================================================================= */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-white rounded-3xl border border-slate-200/90 shadow-sm">
            <div className="space-y-0.5">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-teal-600" />
                <span>Kitchen Sanitation Protocols & Guidelines</span>
              </h2>
              <p className="text-xs text-slate-500">
                Official SOPs, hygiene standards, and interactive close-out checklists for church kitchen stewards
              </p>
            </div>

            {isAdminOrCoordinator && (
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={handleResetProtocols}
                  className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Restore default church protocols"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
                <button
                  onClick={handleOpenAddChecklist}
                  className="px-3.5 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Checklist Task</span>
                </button>
                <button
                  onClick={handleOpenAddProtocol}
                  className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Protocol Card</span>
                </button>
              </div>
            )}
          </div>

          {/* Protocols Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {protocols.map((proto) => {
              const theme = getProtocolTheme(proto.color);
              return (
                <div
                  key={proto.id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className={`p-2.5 rounded-2xl ${theme.bg} ${theme.text} border ${theme.border}`}>
                          <Utensils className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="font-black text-base text-slate-900">{proto.title}</h3>
                          {proto.subtitle && (
                            <p className="text-xs text-slate-500">{proto.subtitle}</p>
                          )}
                        </div>
                      </div>

                      {isAdminOrCoordinator && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEditProtocol(proto)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Edit Protocol"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProtocol(proto.id, proto.title)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Protocol"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <ul className="space-y-2.5 text-xs text-slate-700">
                      {proto.items && proto.items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <Check className={`w-4 h-4 ${theme.accent} shrink-0 mt-0.5`} />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}

            {/* Close-out Checklist Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="p-2.5 rounded-2xl bg-teal-50 text-teal-700 border border-teal-100">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-black text-base text-slate-900">Kitchen Close-out Checklist</h3>
                      <p className="text-xs text-slate-500">Post-fellowship sanitation & safety standards</p>
                    </div>
                  </div>

                  {isAdminOrCoordinator && (
                    <button
                      onClick={handleOpenAddChecklist}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Task</span>
                    </button>
                  )}
                </div>

                <div className="mt-3.5 space-y-2 text-xs">
                  {closeoutChecklist.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer group ${
                        item.completed
                          ? "bg-emerald-50/60 border-emerald-200/80 text-emerald-900"
                          : "bg-slate-50 hover:bg-slate-100/80 border-slate-100 text-slate-700"
                      }`}
                      onClick={() => handleToggleChecklistItem(item.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
                        )}
                        <span
                          className={`font-medium truncate ${
                            item.completed ? "line-through text-slate-400" : "text-slate-700"
                          }`}
                        >
                          {item.task}
                        </span>
                      </div>

                      {isAdminOrCoordinator && (
                        <div
                          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleOpenEditChecklist(item)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white rounded transition-colors"
                            title="Edit task"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteChecklistItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-colors"
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

              <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-900 to-slate-900 text-white space-y-1.5 mt-4">
                <div className="flex items-center gap-2 text-teal-300 text-xs font-black">
                  <Award className="w-4 h-4" />
                  <span>Kitchen Stewards Fellowship</span>
                </div>
                <p className="text-[11px] text-teal-100/80 leading-relaxed">
                  Thank you for ministering through kitchen stewardship. Your service provides a clean, safe, and welcoming environment for our church family!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* MODAL 1: Create / Edit Team */}
      {isTeamModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {editingTeam ? "Edit Dishwashing Unit" : "Create Dishwashing Unit"}
                </h2>
                <span className="text-[11px] text-slate-500">
                  Assign a Bible Study Group, Ministry, or Custom Team to the rotating turn order
                </span>
              </div>
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-3.5 text-xs">
              {/* Unit Mode Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Unit Classification</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCycleModeChange("biblestudy_group")}
                    className={`p-2.5 rounded-2xl border text-center font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${teamForm.cycle_mode === "biblestudy_group"
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-400"
                      }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>BS Group</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCycleModeChange("ministry")}
                    className={`p-2.5 rounded-2xl border text-center font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${teamForm.cycle_mode === "ministry"
                      ? "bg-teal-700 text-white border-teal-700 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-400"
                      }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Ministry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCycleModeChange("custom")}
                    className={`p-2.5 rounded-2xl border text-center font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${teamForm.cycle_mode === "custom"
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-400"
                      }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Custom Unit</span>
                  </button>
                </div>
              </div>

              {/* Conditional Selection Fields */}
              {teamForm.cycle_mode === "biblestudy_group" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Bible Study Group *</label>
                  <select
                    value={teamForm.biblestudy_group_id}
                    onChange={(e) => handleSelectGroup(e.target.value)}
                    className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium cursor-pointer"
                  >
                    <option value="">-- Choose Bible Study Group --</option>
                    {bsGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (Leader: {g.leader_name || "Unassigned"})
                      </option>
                    ))}
                  </select>

                  {/* Visual chips of covered disciples in this group */}
                  {(() => {
                    const selGroup = bsGroups.find(g => String(g.id) === String(teamForm.biblestudy_group_id));
                    const groupMembers = selGroup?.members || [];
                    return (
                      <div className="mt-2.5 p-3 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-teal-950">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-teal-700" />
                            <span>Covered Group Members ({groupMembers.length})</span>
                          </span>
                          {groupMembers.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const allIds = groupMembers.map(m => m.member_id).filter(Boolean) as number[];
                                setTeamForm(prev => ({ ...prev, selectedMemberIds: allIds }));
                              }}
                              className="text-[10px] text-teal-700 hover:text-teal-900 underline font-black cursor-pointer"
                            >
                              Select All Members
                            </button>
                          )}
                        </div>

                        {groupMembers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                            {groupMembers.map((sm) => {
                              const isChecked = teamForm.selectedMemberIds.includes(sm.member_id as number);
                              return (
                                <button
                                  key={sm.id || sm.member_id}
                                  type="button"
                                  onClick={() => {
                                    if (!sm.member_id) return;
                                    setTeamForm(prev => ({
                                      ...prev,
                                      selectedMemberIds: isChecked
                                        ? prev.selectedMemberIds.filter(id => id !== sm.member_id)
                                        : [...prev.selectedMemberIds, sm.member_id as number]
                                    }));
                                  }}
                                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${isChecked
                                    ? "bg-teal-600 text-white shadow-xs"
                                    : "bg-white text-slate-700 border border-teal-200 hover:bg-teal-100/60"
                                    }`}
                                >
                                  {isChecked ? <Check className="w-3 h-3 text-white" /> : <Plus className="w-3 h-3 text-teal-600" />}
                                  <span>{sm.display_name || sm.member_name}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">
                            No members registered in this Bible study group yet. Members will appear here once assigned to this leader.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {teamForm.cycle_mode === "ministry" && (
                <div className="space-y-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select Ministry *</label>
                    <select
                      value={teamForm.ministry_id}
                      onChange={(e) => handleSelectMinistry(e.target.value)}
                      className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium cursor-pointer"
                    >
                      <option value="">-- Choose Ministry --</option>
                      {ministriesList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} Ministry ({m.coordinators?.[0]?.name ? `Coord: ${m.coordinators[0].name}` : "Active"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Visual chips of covered members in this ministry */}
                  {(() => {
                    const selMin = ministriesList.find(m => String(m.id) === String(teamForm.ministry_id));
                    const ministryMembers = getMinistryMembers(selMin);
                    return (
                      <div className="mt-2.5 p-3 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-teal-950">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-teal-700" />
                            <span>Covered Ministry Members ({ministryMembers.length})</span>
                          </span>
                          {ministryMembers.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const allIds = ministryMembers.map(m => m.id);
                                setTeamForm(prev => ({ ...prev, selectedMemberIds: allIds }));
                              }}
                              className="text-[10px] text-teal-700 hover:text-teal-900 underline font-black cursor-pointer"
                            >
                              Select All Members
                            </button>
                          )}
                        </div>

                        {ministryMembers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                            {ministryMembers.map((sm) => {
                              const isChecked = teamForm.selectedMemberIds.includes(sm.id);
                              return (
                                <button
                                  key={sm.id}
                                  type="button"
                                  onClick={() => {
                                    setTeamForm(prev => ({
                                      ...prev,
                                      selectedMemberIds: isChecked
                                        ? prev.selectedMemberIds.filter(id => id !== sm.id)
                                        : [...prev.selectedMemberIds, sm.id]
                                    }));
                                  }}
                                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${isChecked
                                    ? "bg-teal-600 text-white shadow-xs"
                                    : "bg-white text-slate-700 border border-teal-200 hover:bg-teal-100/60"
                                    }`}
                                >
                                  {isChecked ? <Check className="w-3 h-3 text-white" /> : <Plus className="w-3 h-3 text-teal-600" />}
                                  <span>{sm.first_name} {sm.last_name}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">
                            No members registered in this ministry yet. Members will appear here once assigned or matched.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Display Team Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wednesday BS Group, Youth Ministry"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rotation Order (Turn #)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={teamForm.order_seq}
                    onChange={(e) => setTeamForm({ ...teamForm, order_seq: Number(e.target.value) })}
                    className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                  />
                </div>
              </div>

              {/* Point Person / Leader */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Point Person</label>
                  <select
                    value={teamForm.leader_id}
                    onChange={(e) => handleSelectPointPerson(e.target.value)}
                    className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium cursor-pointer"
                  >
                    <option value="">Select Church Member</option>
                    {churchMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({m.ministry_name || "Member"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Phone / Email</label>
                  <input
                    type="text"
                    placeholder="e.g. 0917-123-4567"
                    value={teamForm.leader_contact}
                    onChange={(e) => setTeamForm({ ...teamForm, leader_contact: e.target.value })}
                    className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                  />
                </div>
              </div>

              {/* Color & Volunteers Target */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Color Badge</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["#0D9488", "#0284C7", "#7C3AED", "#EA580C", "#059669", "#D97706", "#DB2777", "#475569"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTeamForm({ ...teamForm, color: c })}
                        className={`w-6 h-6 rounded-full transition-all cursor-pointer ${teamForm.color === c ? "ring-3 ring-teal-500 scale-110 shadow-sm" : "opacity-80"
                          }`}
                        style={{ backgroundColor: c }}
                      ></button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Volunteers Target</label>
                  <input
                    type="number"
                    min="1"
                    value={teamForm.volunteers_count}
                    onChange={(e) => setTeamForm({ ...teamForm, volunteers_count: Number(e.target.value) })}
                    className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kitchen Tasks / Checklist</label>
                <textarea
                  rows={2}
                  value={teamForm.tasks_checklist}
                  onChange={(e) => setTeamForm({ ...teamForm, tasks_checklist: e.target.value })}
                  placeholder="e.g. Wash plates and cups, sanitize counters, take out trash..."
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {editingTeam ? "Save Changes" : "Create Unit"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Add Member to Team */}
      {isAddMemberModalOpen && targetTeam && (() => {
        const targetGroup = bsGroups.find(g => g.id === targetTeam.biblestudy_group_id || g.name === targetTeam.name);
        const targetMinistry = ministriesList.find(m => m.id === targetTeam.ministry_id || targetTeam.name.toLowerCase().includes(m.name.toLowerCase()));
        const existingMemberIds = new Set(targetTeam.members?.map(m => m.member_id) || []);

        const coveredMembersList: { id: number; first_name: string; last_name: string; ministry_name?: string }[] = targetGroup
          ? (targetGroup?.members || []).map(m => {
              const cm = m.member_id ? churchMembers.find(c => c.id === m.member_id) : null;
              return cm || { id: (m.member_id || m.id) as number, first_name: m.display_name || m.member_name || "Member", last_name: "", ministry_name: targetGroup?.name || "BS Group" };
            })
          : targetMinistry
            ? getMinistryMembers(targetMinistry).map(cm => ({ id: cm.id, first_name: cm.first_name, last_name: cm.last_name, ministry_name: targetMinistry.name }))
            : [];

        const unassignedCoveredMembers = coveredMembersList.filter(m => !existingMemberIds.has(m.id));
        const allEligibleChurchMembers = churchMembers.filter(m => !existingMemberIds.has(m.id));

        const hasCoveredEntity = Boolean(targetGroup || targetMinistry);
        const entityLabel = targetGroup ? "Group Members" : (targetMinistry ? `${targetMinistry.name} Members` : "Unit Members");

        const activeList = memberTab === "group" && hasCoveredEntity ? unassignedCoveredMembers : allEligibleChurchMembers;
        const filteredList = activeList.filter(m =>
          `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearchQuery.toLowerCase())
        );

        return createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Add Member to {targetTeam.name}</h2>
                  <span className="text-[11px] text-slate-500">Assign members to this Sunday dishwashing crew</span>
                </div>
                <button
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Segmented Tab: Group / Ministry Members vs All Members */}
              {hasCoveredEntity && (
                <div className="p-1 bg-slate-100 rounded-2xl flex items-center gap-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => { setMemberTab("group"); setSelectedMemberId(""); }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${memberTab === "group"
                      ? "bg-white text-teal-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                      }`}
                  >
                    🎯 {entityLabel} ({unassignedCoveredMembers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMemberTab("all"); setSelectedMemberId(""); }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${memberTab === "all"
                      ? "bg-white text-teal-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                      }`}
                  >
                    👥 All Members ({allEligibleChurchMembers.length})
                  </button>
                </div>
              )}

              <form onSubmit={handleAddMemberToTeam} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Search & Select Member *
                  </label>
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter members by name..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 pl-7 pr-1 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium text-xs"
                    />
                  </div>

                  <select
                    required
                    size={5}
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full bg-slate-50 p-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium text-xs"
                  >
                    {filteredList.map((m) => (
                      <option key={m.id} value={m.id} className="p-1.5 rounded-lg hover:bg-teal-50">
                        {m.first_name} {m.last_name} ({m.ministry_name || "General"})
                      </option>
                    ))}
                    {filteredList.length === 0 && (
                      <option disabled value="" className="p-2 text-slate-400 italic">
                        No eligible members found
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role in Crew</label>
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                  >
                    <option value="Regular Crew Member">Regular Crew Member</option>
                    <option value="Assistant Leader">Assistant Leader</option>
                    <option value="Sanitation Steward">Sanitation Steward</option>
                    <option value="Drying & Storage Lead">Drying & Storage Lead</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddMemberModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedMemberId}
                    className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-black shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Confirm Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* MODAL 3: Swap Sunday Dishwashing Turns */}
      {isSwapModalOpen && swapItem1 && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-teal-600" />
                <span>Swap Sunday Dishwashing Turn</span>
              </h2>
              <button
                onClick={() => setIsSwapModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteSwap} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-1">
                <span className="text-[10px] font-black uppercase text-teal-700 block">Currently Selected Turn:</span>
                <span className="text-sm font-black text-slate-900 block">{swapItem1.date_formatted}</span>
                <span className="text-xs text-slate-600 font-semibold block">Team: <strong>{swapItem1.team?.name}</strong></span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Swap with which upcoming Sunday? *</label>
                <select
                  required
                  value={swapTargetDate}
                  onChange={(e) => setSwapTargetDate(e.target.value)}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-bold text-slate-900 cursor-pointer text-xs"
                >
                  <option value="">-- Choose Sunday to Swap With --</option>
                  {schedule
                    .filter((s) => s.duty_date !== swapItem1.duty_date)
                    .map((s) => (
                      <option key={s.duty_date} value={s.duty_date}>
                        {s.date_formatted} — {s.team?.name || "Unassigned"} (Turn #{s.team?.order_seq || s.week_number})
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSwapModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Confirm Swap
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: Single Date Override Modal ("Mababago lang yan kapag nag edit") */}
      {/* ========================================================================= */}
      {overrideItem && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit className="w-4 h-4 text-teal-600" />
                  <span>Edit Assignment for {overrideItem.date_formatted}</span>
                </h2>
                <span className="text-[10px] text-slate-500">Overrides this single Sunday without altering subsequent recurring turns</span>
              </div>
              <button onClick={() => setOverrideItem(null)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Assign Team / Unit *</label>
                <select
                  required
                  value={overrideTeamId}
                  onChange={(e) => setOverrideTeamId(e.target.value)}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Turn #{t.order_seq} • {t.cycle_mode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="on_duty">On Duty</option>
                  <option value="completed">Completed</option>
                  <option value="swapped">Swapped</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Special Notes / Reasons for Override</label>
                <textarea
                  rows={3}
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="e.g. Assigned to Youth Ministry for Fellowship Sunday celebration."
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md cursor-pointer"
                >
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 5: Create / Edit Protocol Card */}
      {isProtocolModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {editingProtocol ? "Edit Protocol Card" : "Create Protocol Card"}
                </h2>
                <span className="text-[11px] text-slate-500">
                  Customize kitchen sanitation standard operating procedures
                </span>
              </div>
              <button
                onClick={() => setIsProtocolModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProtocol} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Card Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1. Pre-Scraping & Washing Protocol"
                  value={protocolForm.title}
                  onChange={(e) => setProtocolForm({ ...protocolForm, title: e.target.value })}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Subtitle / Summary</label>
                <input
                  type="text"
                  placeholder="e.g. Fellowship cutlery, plates, and bowls handling"
                  value={protocolForm.subtitle}
                  onChange={(e) => setProtocolForm({ ...protocolForm, subtitle: e.target.value })}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Color Theme</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: "teal", label: "Teal", bg: "bg-teal-50 text-teal-700 border-teal-200" },
                    { key: "emerald", label: "Emerald", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { key: "amber", label: "Amber", bg: "bg-amber-50 text-amber-700 border-amber-200" },
                    { key: "rose", label: "Rose", bg: "bg-rose-50 text-rose-700 border-rose-200" },
                    { key: "indigo", label: "Indigo", bg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                    { key: "sky", label: "Sky", bg: "bg-sky-50 text-sky-700 border-sky-200" },
                    { key: "violet", label: "Violet", bg: "bg-violet-50 text-violet-700 border-violet-200" }
                  ].map(theme => (
                    <button
                      key={theme.key}
                      type="button"
                      onClick={() => setProtocolForm({ ...protocolForm, color: theme.key as any })}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${theme.bg} ${
                        protocolForm.color === theme.key ? "ring-2 ring-slate-800 scale-102 shadow-xs" : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-700">Protocol Steps & Instructions *</label>
                  <button
                    type="button"
                    onClick={() => setProtocolForm({ ...protocolForm, items: [...protocolForm.items, ""] })}
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {protocolForm.items.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        placeholder={`Step ${idx + 1} instruction...`}
                        value={step}
                        onChange={(e) => {
                          const newItems = [...protocolForm.items];
                          newItems[idx] = e.target.value;
                          setProtocolForm({ ...protocolForm, items: newItems });
                        }}
                        className="flex-1 bg-slate-50 p-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium text-xs"
                      />
                      {protocolForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = protocolForm.items.filter((_, i) => i !== idx);
                            setProtocolForm({ ...protocolForm, items: newItems });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove step"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProtocolModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md cursor-pointer"
                >
                  {editingProtocol ? "Save Changes" : "Create Protocol"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 6: Create / Edit Checklist Task */}
      {isChecklistModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {editingChecklistItem ? "Edit Checklist Task" : "Add Checklist Task"}
                </h2>
                <span className="text-[11px] text-slate-500">
                  Kitchen close-out procedure task for dishwashing stewards
                </span>
              </div>
              <button
                onClick={() => setIsChecklistModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChecklistItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Task Description *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Wipe down all food prep countertops & stainless tables with disinfectant spray"
                  value={checklistForm.task}
                  onChange={(e) => setChecklistForm({ task: e.target.value })}
                  className="w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-600 font-medium"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChecklistModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md cursor-pointer"
                >
                  {editingChecklistItem ? "Save Changes" : "Add Task"}
                </button>
              </div>
            </form>
          </div>
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

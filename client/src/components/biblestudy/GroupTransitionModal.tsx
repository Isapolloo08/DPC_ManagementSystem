import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { BibleStudyGroup, Ministry, StudyTopic } from "../../types";
import { api } from "../../api";
import { DatePickerInput } from "../common/DatePickerInput";
import { TimePickerInput } from "../common/TimePickerInput";
import { getBookTotalChapters } from "../../utils/curriculumHelper";
import {
  ArrowLeftRight, GitMerge, Users, Check, CheckCircle2,
  AlertCircle, AlertTriangle, Calendar, Clock, MapPin,
  BookOpen, ShieldCheck, X, ChevronRight, ChevronLeft,
  Info, Sparkles, RefreshCw, UserCheck, HelpCircle, ChevronDown,
  Search, Layers, UserPlus
} from "lucide-react";

interface GroupTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGroups: BibleStudyGroup[];
  onTransitionCompleted: (newGroupId: number, message: string) => void;
  systemLocations?: string[];
  systemCategories?: string[];
  allowedMinistries?: Ministry[];
}

const PRESET_REASONS = [
  "Group restructuring",
  "Low group attendance",
  "Ministry transition",
  "Leadership reorganization",
  "Temporary consolidation",
  "Curriculum unification"
];

const STANDARD_BIBLE_BOOKS = [
  { title: "Book of Romans", type: "bible_book", category: "New Testament", total_chapters: 16 },
  { title: "Gospel of John", type: "bible_book", category: "New Testament", total_chapters: 21 },
  { title: "Gospel of Matthew", type: "bible_book", category: "New Testament", total_chapters: 28 },
  { title: "Gospel of Mark", type: "bible_book", category: "New Testament", total_chapters: 16 },
  { title: "Gospel of Luke", type: "bible_book", category: "New Testament", total_chapters: 24 },
  { title: "Acts of the Apostles", type: "bible_book", category: "New Testament", total_chapters: 28 },
  { title: "1 & 2 Corinthians", type: "bible_book", category: "New Testament", total_chapters: 29 },
  { title: "Galatians", type: "bible_book", category: "New Testament", total_chapters: 6 },
  { title: "Ephesians", type: "bible_book", category: "New Testament", total_chapters: 6 },
  { title: "Philippians", type: "bible_book", category: "New Testament", total_chapters: 4 },
  { title: "Colossians", type: "bible_book", category: "New Testament", total_chapters: 4 },
  { title: "1 & 2 Thessalonians", type: "bible_book", category: "New Testament", total_chapters: 8 },
  { title: "1 & 2 Timothy", type: "bible_book", category: "New Testament", total_chapters: 10 },
  { title: "Hebrews", type: "bible_book", category: "New Testament", total_chapters: 13 },
  { title: "James", type: "bible_book", category: "New Testament", total_chapters: 5 },
  { title: "1 & 2 Peter", type: "bible_book", category: "New Testament", total_chapters: 8 },
  { title: "1, 2, 3 John", type: "bible_book", category: "New Testament", total_chapters: 7 },
  { title: "Revelation", type: "bible_book", category: "New Testament", total_chapters: 22 },
  { title: "Genesis", type: "bible_book", category: "Old Testament", total_chapters: 50 },
  { title: "Exodus", type: "bible_book", category: "Old Testament", total_chapters: 40 },
  { title: "Psalms", type: "bible_book", category: "Old Testament", total_chapters: 150 },
  { title: "Proverbs", type: "bible_book", category: "Old Testament", total_chapters: 31 },
  { title: "Ecclesiastes", type: "bible_book", category: "Old Testament", total_chapters: 12 },
  { title: "Isaiah", type: "bible_book", category: "Old Testament", total_chapters: 66 },
  { title: "Jeremiah", type: "bible_book", category: "Old Testament", total_chapters: 52 },
  { title: "Daniel", type: "bible_book", category: "Old Testament", total_chapters: 12 },
  { title: "Discipleship 101: Foundations", type: "curriculum", category: "Topical Track", total_chapters: 8 },
  { title: "Sacred Marriage by Gary Thomas", type: "curriculum", category: "Family & Marriage", total_chapters: 6 },
  { title: "The Cost of Discipleship", type: "curriculum", category: "Discipleship Track", total_chapters: 10 }
];

export const GroupTransitionModal: React.FC<GroupTransitionModalProps> = ({
  isOpen,
  onClose,
  activeGroups,
  onTransitionCompleted,
  systemLocations = [],
  systemCategories = [],
  allowedMinistries = []
}) => {
  // Wizard steps: 1 = Select Groups, 2 = New Group Info, 3 = Leadership, 4 = Schedule & Reason, 5 = Confirm Merge
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Selected groups to merge
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");

  // Step 2: Target group configuration
  const [newGroupName, setNewGroupName] = useState("");
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [category, setCategory] = useState("General");
  const [ministryId, setMinistryId] = useState<string>("");
  const [meetingDay, setMeetingDay] = useState("Wednesday");
  const [meetingTimeStart, setMeetingTimeStart] = useState("7:00 PM");
  const [meetingTimeEnd, setMeetingTimeEnd] = useState("8:30 PM");
  const [location, setLocation] = useState("");
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  const [customLocationText, setCustomLocationText] = useState("");
  const [maxCapacity, setMaxCapacity] = useState(15);

  // Step 3: Single Leader Selection (No Assistant Leader)
  const [leaderName, setLeaderName] = useState("");
  const [leaderContact, setLeaderContact] = useState("");
  const [leaderId, setLeaderId] = useState<number | null>(null);
  const [leaderSearchQuery, setLeaderSearchQuery] = useState("");
  const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false);

  // Step 4: Transition schedule & reason
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("Group restructuring");
  const [notes, setNotes] = useState("");

  // Dynamic fetched lookups & curriculum
  const [fetchedCategories, setFetchedCategories] = useState<string[]>([]);
  const [fetchedStudyTopics, setFetchedStudyTopics] = useState<StudyTopic[]>([]);
  const [curriculumSearchQuery, setCurriculumSearchQuery] = useState("");
  const [isCurriculumDropdownOpen, setIsCurriculumDropdownOpen] = useState(false);

  // Church Directory Leaders
  const [leadersDirectory, setLeadersDirectory] = useState<{
    id: string | number;
    rawId?: number;
    name: string;
    contact: string;
    role_name?: string;
  }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dropdown refs for click outside
  const curriculumRef = useRef<HTMLDivElement>(null);
  const leaderRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (curriculumRef.current && !curriculumRef.current.contains(e.target as Node)) {
        setIsCurriculumDropdownOpen(false);
      }
      if (leaderRef.current && !leaderRef.current.contains(e.target as Node)) {
        setIsLeaderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset & load lookups on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSelectedGroupIds([]);
      setGroupSearchQuery("");
      setNewGroupName("");
      setIsNameManuallyEdited(false);
      setDescription("");
      setCurriculum("");
      setCategory("General");
      setMinistryId("");
      setMeetingDay("Wednesday");
      setMeetingTimeStart("7:00 PM");
      setMeetingTimeEnd("8:30 PM");
      setLocation(systemLocations.length > 0 ? systemLocations[0] : "Fellowship Hall Room 201");
      setIsCustomLocation(false);
      setCustomLocationText("");
      setMaxCapacity(15);
      setLeaderName("");
      setLeaderContact("");
      setLeaderId(null);
      setLeaderSearchQuery("");
      setIsLeaderDropdownOpen(false);
      setEffectiveDate(new Date().toISOString().split("T")[0]);
      setReason("Group restructuring");
      setNotes("");
      setErrorMessage(null);
      setCurriculumSearchQuery("");
      setIsCurriculumDropdownOpen(false);

      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      const [usersRes, membersRes, catLookups, studyRes] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getMembers().catch(() => []),
        api.getLookups({ type: "bible_study_category" }).catch(() => []),
        api.getStudyTopics().catch(() => null)
      ]);

      // 1. Categories
      if (catLookups && Array.isArray(catLookups)) {
        const activeCats = catLookups.filter((c: any) => c.is_active).map((c: any) => c.name);
        setFetchedCategories(activeCats);
      }

      // 2. Study topics
      if (studyRes?.topics) {
        setFetchedStudyTopics(studyRes.topics);
      }

      // 3. Leaders directory (Filter users by Coordinator, Leader, Pastor)
      const ALLOWED_LEADER_ROLES = ["coordinator", "leader", "pastor"];
      const userLeaders = (usersRes || [])
        .filter((u: any) => {
          const role = (u.role_name || "").toLowerCase().trim();
          return ALLOWED_LEADER_ROLES.includes(role);
        })
        .map((u: any) => ({
          id: u.id,
          rawId: u.id,
          name: u.name || `${u.member_first_name || ""} ${u.member_last_name || ""}`.trim() || u.username,
          contact: u.contact_phone || u.email || u.contact_email || "",
          role_name: u.role_name || "Leader"
        }));

      const unique = userLeaders.filter((l: any, idx: number, arr: any[]) =>
        l.name && arr.findIndex((x: any) => x.name.toLowerCase().trim() === l.name.toLowerCase().trim()) === idx
      ).sort((a: any, b: any) => a.name.localeCompare(b.name));

      setLeadersDirectory(unique);
    } catch (err) {
      console.warn("Could not load transition lookups:", err);
    }
  };

  // Filter only mergeable active groups (exclude already merged)
  const availableGroups = useMemo(() => {
    return activeGroups.filter(g => g.status !== "merged");
  }, [activeGroups]);

  const filteredAvailableGroups = useMemo(() => {
    if (!groupSearchQuery.trim()) return availableGroups;
    const q = groupSearchQuery.toLowerCase().trim();
    return availableGroups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.leader_name.toLowerCase().includes(q) ||
      (g.curriculum && g.curriculum.toLowerCase().includes(q)) ||
      (g.category && g.category.toLowerCase().includes(q))
    );
  }, [availableGroups, groupSearchQuery]);

  // Selected group objects
  const selectedGroups = useMemo(() => {
    return availableGroups.filter(g => selectedGroupIds.includes(g.id));
  }, [availableGroups, selectedGroupIds]);

  // Calculate distinct disciples count across selected groups
  const combinedMembers = useMemo(() => {
    const memberMap = new Map<string, { id?: number | null; name: string; phone?: string; group_name: string }>();

    for (const g of selectedGroups) {
      if (g.members && g.members.length > 0) {
        for (const m of g.members) {
          const key = m.member_id ? `id-${m.member_id}` : `name-${(m.display_name || m.member_name || "").toLowerCase().trim()}`;
          if (!memberMap.has(key)) {
            memberMap.set(key, {
              id: m.member_id,
              name: m.display_name || m.member_name || `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Member",
              phone: m.contact_phone || undefined,
              group_name: g.name
            });
          }
        }
      }
    }

    return Array.from(memberMap.values());
  }, [selectedGroups]);

  // Current leaders from selected source groups
  const sourceLeaders = useMemo(() => {
    const map = new Map<string, { group_id: number; group_name: string; leader_name: string; leader_contact?: string }>();
    for (const g of selectedGroups) {
      if (g.leader_name && !map.has(g.leader_name.toLowerCase().trim())) {
        map.set(g.leader_name.toLowerCase().trim(), {
          group_id: g.id,
          group_name: g.name,
          leader_name: g.leader_name,
          leader_contact: g.leader_contact || undefined
        });
      }
    }
    return Array.from(map.values());
  }, [selectedGroups]);

  // Unified dynamic categories list
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    set.add("General");
    (systemCategories || []).forEach(c => set.add(c));
    (fetchedCategories || []).forEach(c => set.add(c));
    selectedGroups.forEach(g => {
      if (g.category) set.add(g.category);
    });
    return Array.from(set);
  }, [systemCategories, fetchedCategories, selectedGroups]);

  // Unified dynamic Curriculum & Book options
  const allCurriculaOptions = useMemo(() => {
    const churchTopics = (fetchedStudyTopics || []).map(t => ({
      title: t.title,
      type: "curriculum",
      category: "Church Topic",
      total_chapters: t.total_chapters || getBookTotalChapters(t.title)
    }));

    const map = new Map<string, { title: string; type: string; category: string; total_chapters: number }>();
    [...churchTopics, ...STANDARD_BIBLE_BOOKS].forEach(item => {
      const key = item.title.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          ...item,
          total_chapters: item.total_chapters || getBookTotalChapters(item.title, fetchedStudyTopics)
        });
      }
    });
    return Array.from(map.values());
  }, [fetchedStudyTopics]);

  const filteredCurricula = useMemo(() => {
    const q = curriculumSearchQuery.toLowerCase().trim();
    if (!q) return allCurriculaOptions;
    return allCurriculaOptions.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }, [allCurriculaOptions, curriculumSearchQuery]);

  // Filtered leaders directory for Step 3
  const filteredLeadersDirectory = useMemo(() => {
    const q = leaderSearchQuery.toLowerCase().trim();
    if (!q) return leadersDirectory;
    return leadersDirectory.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.contact && l.contact.toLowerCase().includes(q)) ||
      (l.role_name && l.role_name.toLowerCase().includes(q))
    );
  }, [leadersDirectory, leaderSearchQuery]);

  // Auto-suggest group name and defaults when source group selection changes
  useEffect(() => {
    if (!isNameManuallyEdited && selectedGroups.length > 0) {
      const names = selectedGroups.map(g => g.name.replace(/group/i, "").trim()).filter(Boolean);
      if (names.length === 2) {
        setNewGroupName(`${names[0]} & ${names[1]}`);
      } else if (names.length > 2) {
        setNewGroupName(`${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`);
      } else if (names.length === 1) {
        setNewGroupName(`${names[0]} (Merged)`);
      }

      // Pre-fill initial defaults from first group if not set
      const first = selectedGroups[0];
      if (first) {
        if (!curriculum) setCurriculum(first.curriculum || "");
        if (!category || category === "General") setCategory(first.category || "General");
        if (first.ministry_id && !ministryId) setMinistryId(String(first.ministry_id));
        if (first.meeting_day) setMeetingDay(first.meeting_day);
        if (first.location && !location) setLocation(first.location);

        // Auto capacity = sum of groups capacity or at least 15
        const totalCap = selectedGroups.reduce((acc, g) => acc + (g.max_capacity || 12), 0);
        setMaxCapacity(Math.max(15, totalCap));

        // Default leader to first source leader if not set
        if (!leaderName && first.leader_name) {
          setLeaderName(first.leader_name);
          setLeaderContact(first.leader_contact || "");
        }
      }
    }
  }, [selectedGroupIds, isNameManuallyEdited]);

  // Toggle selection of a group
  const handleToggleGroup = (groupId: number) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  // Validation before advancing to next step
  const handleNextStep = () => {
    setErrorMessage(null);

    if (currentStep === 1) {
      if (selectedGroupIds.length < 2) {
        setErrorMessage("Please select at least two Bible study groups to merge.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!newGroupName.trim()) {
        setErrorMessage("Please specify the resulting group name.");
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!leaderName.trim()) {
        setErrorMessage("Please assign a group leader for the resulting merged group.");
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (!effectiveDate) {
        setErrorMessage("Please specify the effective date for this transition.");
        return;
      }
      setCurrentStep(5);
    }
  };

  // Handle final merge submission
  const handleConfirmMerge = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const formattedMeetingTime = meetingTimeEnd
        ? `${meetingTimeStart} - ${meetingTimeEnd}`
        : meetingTimeStart;

      const payload = {
        source_group_ids: selectedGroupIds,
        new_group_name: newGroupName.trim(),
        description: description.trim() || undefined,
        curriculum: curriculum.trim() || undefined,
        category: category || "General",
        ministry_id: ministryId ? Number(ministryId) : null,
        meeting_day: meetingDay,
        meeting_time: formattedMeetingTime,
        location: (isCustomLocation ? customLocationText.trim() : location.trim()) || "Fellowship Hall Room 201",
        max_capacity: Number(maxCapacity) || 15,
        primary_leader_name: leaderName.trim(),
        primary_leader_contact: leaderContact.trim() || undefined,
        primary_leader_id: leaderId || undefined,
        assistant_leader_name: undefined,
        assistant_leader_contact: undefined,
        assistant_leader_id: undefined,
        effective_date: effectiveDate,
        reason: reason.trim() || "Group restructuring",
        notes: notes.trim() || undefined
      };

      const res = await api.mergeGroups(payload);

      onTransitionCompleted(res.group_id, res.message || `Successfully merged groups into"${newGroupName.trim()}"!`);
      onClose();
    } catch (err: any) {
      console.error("Merge error:", err);
      setErrorMessage(err.message || "Failed to complete the group merge transition.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-charcoal/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div data-modal-panel className="bg-white rounded-3xl max-w-2xl lg:max-w-3xl w-full shadow-2xl border border-indigo-100 flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in zoom-in-95 duration-200">

        {/* Header Strip */}
        <div data-modal-header className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-2xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-medium shadow-md">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30">
                  Transition Wizard
                </span>
                <span className="text-xs text-slate-300 font-medium">Merge Groups</span>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                Bible Study Group Transition
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="relative z-10 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 px-6 py-3 flex items-center justify-between gap-1 sm:gap-2 text-xs overflow-x-auto no-scrollbar">
          {[
            { step: 1, label: "1. Select Groups" },
            { step: 2, label: "2. New Group Info" },
            { step: 3, label: "3. Leadership" },
            { step: 4, label: "4. Schedule & Reason" },
            { step: 5, label: "5. Confirm Merge" }
          ].map(s => {
            const isCurrent = currentStep === s.step;
            const isCompleted = currentStep > s.step;
            return (
              <div
                key={s.step}
                className={`flex items-center gap-1.5 font-medium whitespace-nowrap px-2.5 py-1 rounded-xl transition-all ${
                  isCurrent
                    ? "bg-indigo text-white shadow-2xs font-medium"
                    : isCompleted
                      ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                      : "text-muted"
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span>{s.step}</span>}
                <span className="hidden sm:inline">{s.label.split(". ")[1]}</span>
              </div>
            );
          })}
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-charcoal">

          {/* STEP 1: SELECT GROUPS TO MERGE */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-ivory-light p-4 rounded-2xl border border-indigo-100">
                <div>
                  <h3 className="font-semibold text-sm text-charcoal flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo" />
                    <span>Select Bible Study Groups to Merge</span>
                  </h3>
                  <p className="text-[12px] text-muted mt-0.5">
                    Choose two or more active small groups. Their member rosters will be combined.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-xl bg-indigo-100 text-indigo-900 font-medium text-xs">
                    Selected: {selectedGroupIds.length} groups
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-900 font-medium text-xs">
                    Combined Disciples: {combinedMembers.length}
                  </span>
                </div>
              </div>

              {/* Search box */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter groups by name, leader, curriculum..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  className="w-full bg-ivory-light p-2.5 pr-8 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-indigo"
                />
                {groupSearchQuery && (
                  <button
                    onClick={() => setGroupSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Group Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {filteredAvailableGroups.length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-muted">
                    No active Bible study groups match your search filter.
                  </div>
                ) : (
                  filteredAvailableGroups.map((g) => {
                    const isSelected = selectedGroupIds.includes(g.id);
                    const memberCount = g.current_member_count || (g.members ? g.members.length : 0);

                    return (
                      <div
                        key={g.id}
                        onClick={() => handleToggleGroup(g.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isSelected
                            ? "bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200 shadow-sm"
                            : "bg-white border-gray-200 hover:border-indigo-200 hover:bg-gray-50/70"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center border mt-0.5 shrink-0 transition-colors ${
                          isSelected
                            ? "bg-indigo border-indigo text-white"
                            : "border-gray-300 bg-white"
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-xs text-charcoal truncate">
                              {g.name}
                            </span>
                            <span
                              className="text-[12px] font-medium px-1.5 py-0.2 rounded-full text-white shrink-0"
                              style={{ backgroundColor: g.ministry_color || "#2C3968" }}
                            >
                              {g.ministry_name || "All-Church"}
                            </span>
                          </div>

                          <div className="text-[12px] text-charcoal/70 mt-1 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate">Leader: <strong>{g.leader_name}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted">
                              <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span>{g.meeting_day} • {g.meeting_time}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted">
                              <Users className="w-3 h-3 text-sage-600 shrink-0" />
                              <span>{memberCount} disciples enrolled</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedGroupIds.length > 0 && (
                <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-[12px] text-amber-950 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Historical Data Protected:</strong> Old session attendance records for{" "}
                    <strong>{selectedGroups.map(g => g.name).join(", ")}</strong> will stay preserved under their original group logs.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: TARGET GROUP CONFIGURATION */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-xs text-indigo-950">Resulting Merged Group Information</h4>
                  <p className="text-[12px] text-muted">
                    Set the name, category, meeting schedule, and curriculum for the combined group.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsNameManuallyEdited(false);
                    const names = selectedGroups.map(g => g.name.replace(/group/i, "").trim()).filter(Boolean);
                    if (names.length === 2) setNewGroupName(`${names[0]} & ${names[1]}`);
                    else if (names.length > 2) setNewGroupName(`${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-50 font-medium text-[12px] flex items-center gap-1 cursor-pointer"
                  title="Reset to auto-suggested name"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Auto Suggest</span>
                </button>
              </div>

              <div>
                <label className="block font-medium text-charcoal/80 mb-1">
                  New Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Joshua & Caleb"
                  value={newGroupName}
                  onChange={(e) => {
                    setNewGroupName(e.target.value);
                    setIsNameManuallyEdited(true);
                  }}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-medium text-charcoal text-xs focus:outline-none focus:border-indigo"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category Dropdown (Fetched Lookups) */}
                <div>
                  <label className="block font-medium text-charcoal/80 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-medium text-indigo cursor-pointer focus:outline-none focus:border-indigo"
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-charcoal/80 mb-1">Ministry Scope</label>
                  <select
                    value={ministryId}
                    onChange={(e) => setMinistryId(e.target.value)}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-medium text-indigo cursor-pointer focus:outline-none focus:border-indigo"
                  >
                    <option value=""> All-Church / General</option>
                    {allowedMinistries.map(m => (
                      <option key={m.id} value={m.id}>{m.name} Ministry</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Book / Study Topic Searchable Dropdown */}
              <div ref={curriculumRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-charcoal/80">Book / Study Topic</label>
                  {curriculum && (
                    <span className="text-[12px] text-indigo-600 font-medium">Select or type custom</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search books & topics (e.g. Gospel of John, Romans, Sacred Marriage)"
                    value={curriculum}
                    onFocus={(e) => {
                      e.target.select();
                      setCurriculumSearchQuery("");
                      setIsCurriculumDropdownOpen(true);
                    }}
                    onClick={() => {
                      setCurriculumSearchQuery("");
                      setIsCurriculumDropdownOpen(true);
                    }}
                    onChange={(e) => {
                      setCurriculum(e.target.value);
                      setCurriculumSearchQuery(e.target.value);
                      setIsCurriculumDropdownOpen(true);
                    }}
                    className="w-full bg-ivory-light p-2.5 pr-14 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs"
                  />
                  {curriculum && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurriculum("");
                        setCurriculumSearchQuery("");
                        setIsCurriculumDropdownOpen(true);
                      }}
                      className="absolute right-7 top-1/2 -translate-y-1/2 text-muted hover:text-rose-500 p-1 cursor-pointer transition-colors"
                      title="Clear topic"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      if (!isCurriculumDropdownOpen) {
                        setCurriculumSearchQuery("");
                      }
                      setIsCurriculumDropdownOpen(!isCurriculumDropdownOpen);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-indigo p-0.5 cursor-pointer"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCurriculumDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {isCurriculumDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100 animate-in fade-in">
                    <div className="p-2 bg-indigo-50/80 text-[12px] font-medium text-indigo-900 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                      <span>Available Books & Topics ({filteredCurricula.length})</span>
                      <span className="text-[12px] text-indigo-600 font-normal">Click to choose</span>
                    </div>
                    {filteredCurricula.length === 0 ? (
                      <div className="p-3 text-center text-muted text-[12px]">
                        No matching topic found. You can continue typing a custom title.
                      </div>
                    ) : (
                      filteredCurricula.map((item, idx) => (
                        <button
                          key={`${item.title}-${idx}`}
                          type="button"
                          onClick={() => {
                            setCurriculum(item.title);
                            setCurriculumSearchQuery("");
                            setIsCurriculumDropdownOpen(false);
                          }}
                          className="w-full text-left p-2.5 hover:bg-indigo-50/60 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-medium text-charcoal group-hover:text-indigo text-xs flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate">{item.title}</span>
                            </div>
                            <div className="text-[12px] text-muted pl-5 flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.2 rounded font-medium text-[12px] ${item.type === "curriculum" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}>
                                {item.category}
                              </span>
                              {item.total_chapters ? (
                                <span className="truncate text-muted">• {item.total_chapters} chapters</span>
                              ) : null}
                            </div>
                          </div>
                          {curriculum === item.title && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-charcoal/80 mb-1">Meeting Day</label>
                  <select
                    value={meetingDay}
                    onChange={(e) => setMeetingDay(e.target.value)}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-medium cursor-pointer"
                  >
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-charcoal/80 mb-1">Start Time</label>
                  <TimePickerInput
                    value={meetingTimeStart}
                    onChange={(val) => setMeetingTimeStart(val)}
                  />
                </div>

                <div>
                  <label className="block font-medium text-charcoal/80 mb-1">End Time</label>
                  <TimePickerInput
                    value={meetingTimeEnd}
                    onChange={(val) => setMeetingTimeEnd(val)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-charcoal/80 mb-1">Location / Room</label>
                  <select
                    value={isCustomLocation ? "__custom__" : location}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setIsCustomLocation(true);
                      } else {
                        setIsCustomLocation(false);
                        setLocation(e.target.value);
                      }
                    }}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-medium text-xs cursor-pointer"
                  >
                    {systemLocations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                    {location && !systemLocations.includes(location) && (
                      <option value={location}>{location}</option>
                    )}
                    <option value="__custom__">+ Custom Location...</option>
                  </select>

                  {isCustomLocation && (
                    <input
                      type="text"
                      placeholder="Type room name or address..."
                      value={customLocationText}
                      onChange={(e) => {
                        setCustomLocationText(e.target.value);
                        setLocation(e.target.value);
                      }}
                      className="w-full mt-2 bg-white p-2.5 rounded-xl border border-indigo-300 font-medium animate-in fade-in"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-medium text-charcoal/80 mb-1">Max Capacity</label>
                  <input
                    type="number"
                    min={combinedMembers.length || 1}
                    max={100}
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(Number(e.target.value) || 15)}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-charcoal/80 mb-1">Description / Group Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Focus, target fellowship, or notes about this merged group..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200"
                />
              </div>
            </div>
          )}

          {/* STEP 3: SINGLE LEADERSHIP SELECTION */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200">
                <h4 className="font-semibold text-xs text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Assign Group Leader</span>
                </h4>
                <p className="text-[12px] text-amber-900/80 mt-0.5">
                  Select a leader from the source groups, or search the church directory to assign a different leader.
                </p>
              </div>

              {/* 1. Quick Select From Selected Source Group Leaders */}
              <div className="space-y-2">
                <label className="block font-medium text-charcoal/80">
                  Current Leaders in Selected Groups:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {sourceLeaders.map((sl, idx) => {
                    const isSelected = leaderName.toLowerCase().trim() === sl.leader_name.toLowerCase().trim();
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setLeaderName(sl.leader_name);
                          setLeaderContact(sl.leader_contact || "");
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 select-none ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 shadow-xs"
                            : "bg-ivory-light border-gray-200 hover:border-indigo-300 hover:bg-white"
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-medium text-xs shrink-0 ${
                            isSelected ? "bg-indigo text-white" : "bg-indigo-100 text-indigo-800"
                          }`}>
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-xs text-charcoal truncate">{sl.leader_name}</div>
                            <div className="text-[12px] text-muted truncate">From: {sl.group_name}</div>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-xl text-[12px] font-medium shrink-0 transition-colors ${
                          isSelected
                            ? "bg-indigo text-white shadow-2xs"
                            : "bg-white text-indigo border border-indigo-200 hover:bg-indigo-50"
                        }`}>
                          {isSelected ? <><Check aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Selected</> : "Select"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Or Choose Another Leader from Church Directory */}
              <div ref={leaderRef} className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-xs text-indigo-950 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-indigo" />
                    <span>Choose Another Church Leader / Member:</span>
                  </label>
                  <span className="text-[12px] text-indigo-700 font-medium">Directory Search</span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search church leaders & members by name, role, phone..."
                    value={leaderSearchQuery}
                    onFocus={() => setIsLeaderDropdownOpen(true)}
                    onClick={() => setIsLeaderDropdownOpen(true)}
                    onChange={(e) => {
                      setLeaderSearchQuery(e.target.value);
                      setIsLeaderDropdownOpen(true);
                    }}
                    className="w-full bg-white p-2.5 pr-8 rounded-xl border border-gray-200 font-medium text-xs focus:outline-none focus:border-indigo"
                  />
                  <Search className="w-3.5 h-3.5 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {isLeaderDropdownOpen && (
                  <div className="absolute left-4 right-4 top-full mt-1 z-50 bg-white rounded-2xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100 animate-in fade-in">
                    <div className="p-2 bg-indigo-50/80 text-[12px] font-medium text-indigo-900 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                      <span>Church Directory Leaders ({filteredLeadersDirectory.length})</span>
                      <span className="text-[12px] text-indigo-600 font-normal">Click to assign</span>
                    </div>
                    {filteredLeadersDirectory.length === 0 ? (
                      <div className="p-3 text-center text-muted text-xs">
                        No leaders found matching "{leaderSearchQuery}"
                      </div>
                    ) : (
                      filteredLeadersDirectory.map((l) => {
                        const isMatch = leaderName.toLowerCase().trim() === l.name.toLowerCase().trim();
                        return (
                          <div
                            key={l.id}
                            onClick={() => {
                              setLeaderName(l.name);
                              setLeaderContact(l.contact || "");
                              setLeaderId(l.rawId || null);
                              setLeaderSearchQuery("");
                              setIsLeaderDropdownOpen(false);
                            }}
                            className={`p-2.5 hover:bg-indigo-50/70 flex items-center justify-between cursor-pointer transition-colors ${
                              isMatch ? "bg-indigo-50 font-medium" : ""
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-medium text-charcoal text-xs">{l.name}</div>
                              <div className="text-[12px] text-muted mt-0.5 flex items-center gap-1.5">
                                <span className="bg-gray-100 px-1.5 py-0.2 rounded text-[12px] font-medium text-charcoal/80">
                                  {l.role_name}
                                </span>
                                {l.contact && <span className="truncate">• {l.contact}</span>}
                              </div>
                            </div>
                            {isMatch && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* 3. Selected Leader Confirmation Card */}
              <div className="p-4 bg-white rounded-2xl border-2 border-indigo-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-xs text-indigo-950 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo" />
                    <span>Assigned Leader for Resulting Group *</span>
                  </label>
                  {leaderName && (
                    <span className="text-[12px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><Check aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Ready
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-muted mb-1">Leader Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mark Angelo"
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value)}
                      className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-medium text-xs focus:outline-none focus:border-indigo"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-muted mb-1">Leader Contact Phone / Email</label>
                    <input
                      type="text"
                      placeholder="e.g. 0917-123-4567 or email"
                      value={leaderContact}
                      onChange={(e) => setLeaderContact(e.target.value)}
                      className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-medium text-xs focus:outline-none focus:border-indigo"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SCHEDULE & REASON */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-ivory-light p-3.5 rounded-2xl border border-indigo-100">
                <h4 className="font-semibold text-xs text-charcoal">Transition Date & Ministry Context</h4>
                <p className="text-[12px] text-muted">
                  Record when this merge officially takes effect in Church records and reports.
                </p>
              </div>

              <div>
                <label className="block font-medium text-charcoal/80 mb-1">
                  Effective Transition Date *
                </label>
                <div className="max-w-xs">
                  <DatePickerInput
                    value={effectiveDate}
                    onChange={(val) => setEffectiveDate(val)}
                  />
                </div>
                <p className="text-[12px] text-muted mt-1">
                  Attendance logged on or after this date will belong to the merged group.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block font-medium text-charcoal/80">
                  Reason for Transition:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_REASONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                        reason === r
                          ? "bg-indigo text-white border-indigo shadow-2xs"
                          : "bg-white text-charcoal/70 border-gray-200 hover:bg-indigo-50"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or enter custom reason..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full mt-2 bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-charcoal/80 mb-1">
                  Additional Transition Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Any extra administrative notes, agreements, or leadership decisions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200"
                />
              </div>
            </div>
          )}

          {/* STEP 5: CONFIRMATION REVIEW */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center py-2">
                <div className="inline-flex p-3 rounded-full bg-amber-100 text-amber-900 mb-2">
                  <GitMerge className="w-8 h-8 text-amber-700" />
                </div>
                <h3 className="text-base font-semibold text-charcoal">
                  Confirm Bible Study Group Merge
                </h3>
                <p className="text-xs text-muted max-w-md mx-auto mt-0.5">
                  Review the summary below before executing the transition transaction.
                </p>
              </div>

              {/* Side by Side Comparison Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Source Groups Box */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-medium text-xs text-slate-800 uppercase tracking-wider">
                      Source Groups ({selectedGroups.length})
                    </span>
                    <span className="text-[12px] font-medium text-slate-500">Will be marked MERGED</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedGroups.map(g => {
                      const count = g.current_member_count || (g.members ? g.members.length : 0);
                      return (
                        <div key={g.id} className="p-2.5 bg-white rounded-xl border border-slate-200 text-[12px]">
                          <div className="font-medium text-slate-900">{g.name}</div>
                          <div className="text-slate-600 mt-0.5 flex items-center justify-between">
                            <span>Leader: {g.leader_name}</span>
                            <span className="font-medium text-indigo">{count} members</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resulting Group Box */}
                <div className="p-4 bg-indigo-50/70 rounded-2xl border-2 border-indigo-200 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
                    <span className="font-medium text-xs text-indigo-950 uppercase tracking-wider">
                      Resulting Combined Group
                    </span>
                    <span className="text-[12px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                      ACTIVE
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-charcoal">
                    <div>
                      <span className="text-muted text-[12px] font-medium block">Group Name:</span>
                      <span className="font-medium text-indigo-950 text-sm">{newGroupName}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-100 text-[12px]">
                      <div>
                        <span className="text-muted block">Category:</span>
                        <span className="font-medium text-charcoal">{category}</span>
                      </div>
                      <div>
                        <span className="text-muted block">Combined Disciples:</span>
                        <span className="font-medium text-emerald-800">{combinedMembers.length} Enrolled</span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-indigo-100 text-[12px] space-y-1">
                      <div>
                        <span className="text-muted">Group Leader: </span>
                        <strong className="text-indigo-950">{leaderName}</strong>
                        {leaderContact && <span className="text-muted"> ({leaderContact})</span>}
                      </div>
                      <div>
                        <span className="text-muted">Study Track: </span>
                        <strong className="text-charcoal">{curriculum || "General Scripture Discussion"}</strong>
                      </div>
                      <div>
                        <span className="text-muted">Schedule: </span>
                        <span>{meetingDay} at {meetingTimeStart} - {meetingTimeEnd}</span>
                      </div>
                      <div>
                        <span className="text-muted">Effective Date: </span>
                        <strong className="text-amber-900">{effectiveDate}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Critical Historical Data Notice */}
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-medium text-amber-950">Important Database Safety Notice:</div>
                  <div className="text-[12px] text-amber-900/90 leading-relaxed">
                    Historical attendance, previous session roll-calls, and reports from{" "}
                    <strong>{selectedGroups.map(g => g.name).join(" and ")}</strong> will permanently remain tied to their original group IDs. Future sessions starting {effectiveDate} will be recorded under <strong>{newGroupName}</strong>.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div data-modal-footer className="p-4 sm:p-5 bg-slate-50 border-t border-gray-100 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => (prev - 1) as any)}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200 font-medium text-xs text-charcoal flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200 font-medium text-xs text-charcoal transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}

          <div className="flex items-center gap-2">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-6 py-2.5 rounded-2xl bg-indigo hover:bg-indigo-700 text-white font-medium text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <span>Next Step</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmMerge}
                className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Merge...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>Confirm & Execute Merge</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

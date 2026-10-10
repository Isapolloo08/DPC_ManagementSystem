import { FilterPanel } from "../components/common/FilterPanel";
import { Pagination } from "../components/common/Pagination";
import { usePageControls, useDebouncedValue } from "../hooks/useListPagination";
import { StatCard } from "../components/common/StatCard";
import { PageHeader } from "../components/common/PageHeader";
import { Info as UIInfo } from "lucide-react";
import { ModalShell } from "../components/common/ModalShell";
import { Badge } from "../components/common/Badge";
import { ActionMenu } from "../components/common/ActionMenu";
import { formatDisplayDate } from "../utils/displayDate";
import "../components/biblestudy/study-design.css";
import { ModalPanel } from "../components/common/ModalPanel";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { BibleStudyGroup, StudyTopic, StudyTopicsSummary, User } from "../types";
import { TimePickerInput } from "../components/common/TimePickerInput";
import { DatePickerInput } from "../components/common/DatePickerInput";
import { DateTimePickerInput } from "../components/common/DateTimePickerInput";
import { useSocketEvent } from "../socket";
import { BibleStudyPageSkeleton, CardGridSkeleton } from "../components/common/SkeletonLoader";
import { ConfirmationModal, ModalType } from "../components/common/ConfirmationModal";
import { BibleStudyRescheduleModal } from "../components/biblestudy/BibleStudyRescheduleModal";
import { GroupTransitionModal } from "../components/biblestudy/GroupTransitionModal";
import { GroupHistoryModal } from "../components/biblestudy/GroupHistoryModal";
import { SessionHistoryModal } from "../components/biblestudy/SessionHistoryModal";
import { GroupDetailsModal } from "../components/biblestudy/GroupDetailsModal";
import { ScheduleSuggestionsModal } from "../components/biblestudy/ScheduleSuggestionsModal";
import { Button } from "../components/common/Button";
import { formatScheduleTime, parseScheduleTime, type ScheduleParticipant } from "../utils/bibleStudyScheduleSuggestions";
import {
  BookOpen, Plus, Users, Calendar, Clock, MapPin,
  Search, Filter, CheckCircle2, X, Phone,
  Layers, ShieldCheck, HeartHandshake,
  Award, CheckCheck, Library, BookmarkCheck,
  ChevronDown, User as UserIcon, Check, Edit, FileText, AlertCircle,
  CalendarClock, AlertTriangle, GitMerge, History, ArrowRight, ArrowLeftRight, UserCheck,
  Archive, RotateCcw, Sparkles
} from "lucide-react";
import { getBookTotalChapters, generateChapterOptions } from "../utils/curriculumHelper";
import { StudyProgressFields } from "../components/biblestudy/StudyProgressFields";
import { LessonNoticeField } from "../components/biblestudy/LessonNoticeField";

const toDateTimeLocal = (dateStr?: string, timeStr?: string) => {
  const d = dateStr || new Date(Date.now() + 86400000).toISOString().split("T")[0];
  let hours = 19;
  let minutes = "00";
  if (timeStr) {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2];
      const p = match[3]?.toUpperCase();
      if (p === "PM" && h < 12) h += 12;
      if (p === "AM" && h === 12) h = 0;
      hours = h;
      minutes = m.padStart(2, "0");
    }
  }
  return `${d}T${String(hours).padStart(2, "0")}:${minutes}`;
};

interface BibleStudyPageProps {
  initialGroupId?: number | null;
}

export const BibleStudyPage: React.FC<BibleStudyPageProps> = ({ initialGroupId }) => {
  const { user, allowedMinistries, isRestricted, selectedMinistryId } = useAuth();
  const { showToast, deleteWithUndo } = useToast();
  const [groups, setGroups] = useState<BibleStudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [studySummary, setStudySummary] = useState<StudyTopicsSummary | null>(null);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);
  const [isJoinSuccess, setIsJoinSuccess] = useState<string | null>(null);

  // Group Transition & History Modals State
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [historyGroup, setHistoryGroup] = useState<BibleStudyGroup | null>(null);
  const [sessionHistoryGroup, setSessionHistoryGroup] = useState<BibleStudyGroup | null>(null);
  const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState(false);

  // Complete Group Lifecycle Modal State
  const [completeGroupModal, setCompleteGroupModal] = useState<BibleStudyGroup | null>(null);
  const [completeFormData, setCompleteFormData] = useState({
    completed_book_title_snapshot: "",
    completed_chapter: "",
    completed_total_chapters: 12,
    notes: ""
  });
  const [isCompleting, setIsCompleting] = useState(false);

  // Archive (Soft-Delete) Confirmation Modal State
  const [archiveGroupModal, setArchiveGroupModal] = useState<BibleStudyGroup | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);

  // Restore Group Confirmation Modal State
  const [restoreGroupModal, setRestoreGroupModal] = useState<BibleStudyGroup | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

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
    confirmText: "Okay",
    onConfirm: () => { }
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

  const initialMinistry = isRestricted && allowedMinistries.length > 0
    ? String(allowedMinistries[0].id)
    : (selectedMinistryId ? String(selectedMinistryId) : "");

  // Main visible lifecycle filters: Active | Completed | Archived | All
  const [statusFilter, setStatusFilter] = useState<"active" | "completed" | "archived" | "all">("active");

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterMinistry, setFilterMinistry] = useState<string>(initialMinistry);
  const [filterDay, setFilterDay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { page, pageSize, setPage, setPageSize } = usePageControls(JSON.stringify([filterMinistry, selectedCategory, filterDay, statusFilter, debouncedSearch]));
  const [serverTotal, setServerTotal] = useState(0);
  const [serverPaged, setServerPaged] = useState(false);
  const [groupSummary, setGroupSummary] = useState<Record<string, number> | null>(null);
  const listSequence = useRef(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [transitionGroups, setTransitionGroups] = useState<BibleStudyGroup[]>([]);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<BibleStudyGroup | null>(null);

  // Quick Chapter Progress Modal State
  const [progressGroupModal, setProgressGroupModal] = useState<BibleStudyGroup | null>(null);
  const [progressFormData, setProgressFormData] = useState({
    curriculum: "",
    current_chapter: "Chapter 1",
    progress_stage: "in_progress",
    progress_notes: ""
  });
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  // Reschedule Modal State
  const [rescheduleGroupModal, setRescheduleGroupModal] = useState<BibleStudyGroup | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    curriculum: "",
    ministry_id: isRestricted && allowedMinistries.length > 0 ? String(allowedMinistries[0].id) : "",
    leader_name: "",
    leader_contact: "",
    meeting_day: "Wednesday",
    meeting_time_start: "7:00 PM",
    meeting_time_end: "8:30 PM",
    location: "Fellowship Hall Room 201",
    category: "General",
    max_capacity: 12,
    current_chapter: "Chapter 1",
    progress_stage: "in_progress",
    progress_notes: ""
  });

  const [systemCategories, setSystemCategories] = useState<string[]>([]);
  const [systemLocations, setSystemLocations] = useState<string[]>([]);

  const categories = useMemo(() => ["All", ...systemCategories], [systemCategories]);
  const daysOfWeek = useMemo(
    () => ["All Days", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    []
  );
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

  // Dropdown states & refs
  const [leadersList, setLeadersList] = useState<{ id: string | number; name: string; contact: string; role_name?: string; member_id?: number | null }[]>([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | number | null>(null);
  const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false);
  const [isCurriculumDropdownOpen, setIsCurriculumDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  const [customLocationText, setCustomLocationText] = useState("");

  // Group Members Enrollment State
  const [membersList, setMembersList] = useState<(ScheduleParticipant & { ministry_name?: string; age?: number; bible_study_group_id?: number | null; bible_study_group_name?: string | null })[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [isScheduleSuggestionsOpen, setIsScheduleSuggestionsOpen] = useState(false);
  const [appliedScheduleSignature, setAppliedScheduleSignature] = useState<string | null>(null);
  const [membersLoadError, setMembersLoadError] = useState(false);
  const scheduleMembers = useMemo(() => selectedMemberIds.map(id => membersList.find(member => member.id === id)
    || { id, name: `Member #${id}`, class_schedule: null }), [selectedMemberIds, membersList]);
  const scheduleLeader = useMemo(() => {
    const leader = leadersList.find(item => item.id === selectedLeaderId);
    if (!leader) return formData.leader_name ? { id: -1, name: formData.leader_name, class_schedule: null } : null;
    const member = membersList.find(item => item.id === leader.member_id);
    return { id: leader.member_id || -1, name: leader.name, class_schedule: member?.class_schedule };
  }, [leadersList, selectedLeaderId, membersList, formData.leader_name]);
  const scheduleSignature = JSON.stringify({ members: [...scheduleMembers].sort((a, b) => a.id - b.id)
    .map(member => [member.id, member.class_schedule]), leader: scheduleLeader, selectedLeaderId });
  const [memberQuery, setMemberQuery] = useState<string>("");
  const [memberMinistryFilter, setMemberMinistryFilter] = useState<string>("all");
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);

  const [curriculumQuery, setCurriculumQuery] = useState<string>("");
  const [leaderQuery, setLeaderQuery] = useState<string>("");
  const [locationQuery, setLocationQuery] = useState<string>("");

  const leaderRef = useRef<HTMLDivElement>(null);
  const curriculumRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const memberRef = useRef<HTMLDivElement>(null);
  const scheduleTriggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (leaderRef.current && !leaderRef.current.contains(e.target as Node)) {
        setIsLeaderDropdownOpen(false);
        setLeaderQuery("");
      }
      if (curriculumRef.current && !curriculumRef.current.contains(e.target as Node)) {
        setIsCurriculumDropdownOpen(false);
        setCurriculumQuery("");
      }
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setIsLocationDropdownOpen(false);
        setLocationQuery("");
      }
      // Closing the inline member list on mousedown can move the schedule button
      // before mouseup. Let its click open the popup and close the list together.
      if (memberRef.current && !memberRef.current.contains(e.target as Node)
        && !scheduleTriggerRef.current?.contains(e.target as Node)) {
        setIsMemberDropdownOpen(false);
        setMemberQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    loadData();
  }, [filterMinistry, selectedCategory, filterDay, statusFilter, debouncedSearch, page, pageSize]);
  useEffect(() => () => { listSequence.current++; }, []);

  // Real-time synchronization
  useSocketEvent("groups:changed", () => loadData());
  useSocketEvent("members:changed", () => loadData());
  useSocketEvent("lookups:changed", () => loadData());
  useSocketEvent("study_topics:changed", () => loadData());

 const loadData = async () => {
    const sequence = ++listSequence.current;
    guideData.clearError();
    try {
      setLoading(true);
      const params: any = { page, limit: pageSize, status: statusFilter };
      if (filterMinistry !== "all" && filterMinistry) params.ministry_id = Number(filterMinistry);
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (filterDay !== "all") params.meeting_day = filterDay;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const [groupsRes, studyRes, categoriesRes, locationsRes] = await Promise.all([
        api.getGroupsPage(params),
        api.getStudyTopics().catch(() => null),
        api.getLookups({ type: "bible_study_category" }).catch(() => []),
        api.getLookups({ type: "event_location" }).catch(() => [])
      ]);

      if (sequence !== listSequence.current) return;
      const items = Array.isArray(groupsRes) ? groupsRes : groupsRes.data;
      setGroups(items);
      setServerPaged(!Array.isArray(groupsRes));
      if (!Array.isArray(groupsRes)) {
        setServerTotal(groupsRes.pagination.total); setGroupSummary(groupsRes.summary || null);
        if (groupsRes.pagination.page !== page) setPage(groupsRes.pagination.page);
      } else setGroupSummary(null);
      if (initialGroupId) {
        const linkedGroup = items.find(group => group.id === initialGroupId);
        if (linkedGroup) setSelectedGroup(linkedGroup);
        else api.getGroupById(initialGroupId).then(group => { if (sequence === listSequence.current) setSelectedGroup(group); }).catch(() => {});
      }
      setStudySummary(studyRes);
      setSystemCategories(categoriesRes.filter((c: any) => c.is_active).map((c: any) => c.name));
      setSystemLocations(locationsRes.filter((l: any) => l.is_active).map((l: any) => l.name));

      // Enrollment and leader lookups load only while the form is open.
    } catch (err) {
      if (sequence !== listSequence.current) return;
      console.error("Failed to load Bible study data:", err);
      guideData.reportError(err);
    } finally {
      if (sequence === listSequence.current) { setHasLoaded(true); setLoading(false); }
    }
  };

  const memberLookupQuery = useDebouncedValue(memberQuery);
  const leaderLookupQuery = useDebouncedValue(leaderQuery);
  const memberSequence = useRef(0);
  const leaderSequence = useRef(0);
  useEffect(() => {
    if (!isCreateModalOpen) return;
    void loadMembersForEnrollment(filterMinistry);
    return () => { memberSequence.current++; };
  }, [isCreateModalOpen, memberLookupQuery, memberMinistryFilter, selectedMemberIds.join(","), selectedLeaderId, filterMinistry]);
  useEffect(() => {
    if (!isCreateModalOpen) return;
    void loadLeadersList(filterMinistry);
    return () => { leaderSequence.current++; };
  }, [isCreateModalOpen, leaderLookupQuery, filterMinistry]);
  useEffect(() => {
    if (!isTransitionModalOpen) return;
    let active = true;
    api.getGroups({ status: "all" }).then(items => { if (active) setTransitionGroups(items); }).catch(() => {});
    return () => { active = false; };
  }, [isTransitionModalOpen]);

  const loadMembersForEnrollment = async (ministryId?: number | string) => {
    const sequence = ++memberSequence.current;
    try {
      const scope = memberMinistryFilter !== "all" ? allowedMinistries.find(ministry => ministry.name === memberMinistryFilter)?.id : ministryId && ministryId !== "all" ? Number(ministryId) : undefined;
      const response = await api.getMembers({ ministry_id: scope, page: 1, limit: 30, search: memberLookupQuery });
      const res = Array.isArray(response) ? response : response.data || [];
      const selectedIds = [...new Set([...selectedMemberIds, leadersList.find(leader => leader.id === selectedLeaderId)?.member_id].filter((id): id is number => Boolean(id)))];
      const found = new Set(res.map((member: any) => member.id));
      const missing = selectedIds.filter(id => !found.has(id));
      for (let index = 0; index < missing.length; index += 100) {
        const selected = await api.getMembers({ ids: missing.slice(index, index + 100) });
        res.push(...(Array.isArray(selected) ? selected : selected.data || []));
      }
      if (sequence !== memberSequence.current) return;
      const members = res.map((m: any) => ({
        id: m.id,
        name: `${m.first_name} ${m.last_name}`,
        ministry_name: m.ministry_name,
        class_schedule: m.class_schedule,
        bible_study_group_id: m.bible_study_group_id || null,
        bible_study_group_name: m.bible_study_group_name || null,
        age: m.birthdate ? Math.floor((new Date().getTime() - new Date(m.birthdate).getTime()) / 31557600000) : undefined
      })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setMembersList(members);
      setMembersLoadError(false);
    } catch (err) {
      if (sequence !== memberSequence.current) return;
      console.warn("Could not load members for enrollment", err);
      setMembersList([]);
      setMembersLoadError(true);
    }
  };

  const loadLeadersList = async (ministryId?: number | string) => {
    const sequence = ++leaderSequence.current;
    try {
      const response = await api.getUsersPage({ page: 1, limit: 30, eligible_leaders: "true", search: leaderLookupQuery }).catch(() => []);
      if (sequence !== leaderSequence.current) return;
      const usersRes = Array.isArray(response) ? response : response.data;

      const ALLOWED_LEADER_ROLES = ["coordinator", "leader", "pastor"];
      const userLeaders = (usersRes || [])
        .filter((u: any) => {
          const role = (u.role_name || "").toLowerCase().trim();
          return ALLOWED_LEADER_ROLES.includes(role);
        })
        .map((u: any) => ({
          id: u.id,
          member_id: u.member_id,
          name: u.name || `${u.member_first_name || ""} ${u.member_last_name || ""}`.trim() || u.username,
          contact: u.contact_phone || u.email || u.contact_email || "",
          role_name: u.role_name || "Leader"
        }));

      const unique = userLeaders.filter((l: any, idx: number, arr: any[]) =>
        l.name && arr.findIndex((x: any) => x.name.toLowerCase().trim() === l.name.toLowerCase().trim()) === idx
      ).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setLeadersList(unique);
    } catch (err) {
      if (sequence !== leaderSequence.current) return;
      console.warn("Could not load users for leader options", err);
      setLeadersList([]);
    }
  };

  const filteredLeaders = useMemo(() => {
    const q = leaderQuery.toLowerCase().trim();
    if (!q) return leadersList;
    return leadersList.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.contact && l.contact.toLowerCase().includes(q)) ||
      (l.role_name && l.role_name.toLowerCase().includes(q))
    );
  }, [leadersList, leaderQuery]);



  const allCurricula = useMemo(() => {
    const churchTopics = (studySummary?.topics || []).map(t => ({
      title: t.title,
      type: "curriculum",
      category: "Church Topic",
      total_chapters: t.total_chapters || getBookTotalChapters(t.title)
    }));

    const bibleBooks = [
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

    const map = new Map<string, { title: string; type: string; category: string; total_chapters: number }>();
    [...churchTopics, ...bibleBooks].forEach(item => {
      if (!map.has(item.title.toLowerCase().trim())) {
        map.set(item.title.toLowerCase().trim(), {
          ...item,
          total_chapters: item.total_chapters || getBookTotalChapters(item.title, studySummary?.topics || [])
        });
      }
    });
    return Array.from(map.values());
  }, [studySummary]);

  const filteredCurricula = useMemo(() => {
    const q = curriculumQuery.toLowerCase().trim();
    if (!q) return allCurricula;
    return allCurricula.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }, [allCurricula, curriculumQuery]);

  const memberMinistries = useMemo(() => {
    const set = new Set<string>();
    (allowedMinistries || []).forEach(m => set.add(m.name));
    (membersList || []).forEach(m => {
      if (m.ministry_name) set.add(m.ministry_name);
    });
    return ["all", ...Array.from(set).sort()];
  }, [allowedMinistries, membersList]);

  const filteredMembers = useMemo(() => {
    // Collect all member IDs currently in other active Bible study groups
    const enrolledInOtherActiveGroups = new Set<number>();
    groups.filter(g => (g.status || "active") === "active").forEach(g => {
      if (g.id !== editingGroupId) {
        (g.members || []).forEach((m: any) => {
          const mId = m.member_id || m.id;
          if (mId) enrolledInOtherActiveGroups.add(Number(mId));
        });
      }
    });

    const q = memberQuery.toLowerCase().trim();
    // Only show members who do not currently belong to an active Bible study group
    const list = membersList.filter(m => {
      if (enrolledInOtherActiveGroups.has(m.id)) return false;
      if (m.bible_study_group_id && m.bible_study_group_id !== editingGroupId) return false;
      if (memberMinistryFilter !== "all" && m.ministry_name !== memberMinistryFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.ministry_name && m.ministry_name.toLowerCase().includes(q))
      );
    });

    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [membersList, memberQuery, groups, editingGroupId, memberMinistryFilter]);

  const enrolledMembersDetails = useMemo(() => {
    const editingGroup = editingGroupId ? groups.find(g => g.id === editingGroupId) : null;
    return selectedMemberIds.map(id => {
      const fromList = membersList.find(m => m.id === id);
      if (fromList) return fromList;
      const fromGroup = editingGroup?.members?.find((m: any) => (m.member_id || m.id) === id);
      if (fromGroup) {
        return {
          id: id,
          name: `${fromGroup.first_name || ""} ${fromGroup.last_name || ""}`.trim() || fromGroup.member_name || `Member #${id}`,
          ministry_name: (fromGroup as any).ministry_name,
          age: undefined
        };
      }
      return {
        id: id,
        name: `Member #${id}`,
        ministry_name: undefined,
        age: undefined
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedMemberIds, membersList, groups, editingGroupId]);

  const getProgressStageBadge = (stage?: string) => {
    switch (stage) {
      case "completed":
        return { label: "Completed", bg: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "bg-emerald-600" };
      case "midway":
        return { label: "Mid-way", bg: "bg-amber-100 text-amber-900 border-amber-300", dot: "bg-amber-600" };
      case "application":
        return { label: "Discussion", bg: "bg-orange-100 text-orange-900 border-orange-300", dot: "bg-orange-600" };
      case "intro":
        return { label: "Starting", bg: "bg-teal-100 text-teal-900 border-teal-300", dot: "bg-teal-600" };
      case "review":
        return { label: "Review / Q&A", bg: "bg-sky-100 text-sky-900 border-sky-300", dot: "bg-sky-600" };
      case "exam":
        return { label: "Exam / Assessment", bg: "bg-amber-100 text-amber-900 border-amber-300", dot: "bg-amber-600" };
      case "chapter_completed":
        return { label: "Chapter finished", bg: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "bg-emerald-600" };
      default:
        return { label: "In Progress", bg: "bg-indigo-100 text-indigo-900 border-indigo-300", dot: "bg-indigo-600" };
    }
  };

  const activeCount = useMemo(() => {
    if (groupSummary) return groupSummary.active || 0;
    return groups.filter(g => (g.status || "active") === "active").length;
  }, [groups, groupSummary]);

  const completedCount = useMemo(() => {
    if (groupSummary) return groupSummary.completed || 0;
    return groups.filter(g => g.status === "completed").length;
  }, [groups, groupSummary]);

  const archivedCount = useMemo(() => {
    if (groupSummary) return groupSummary.archived || 0;
    return groups.filter(g => g.status === "archived").length;
  }, [groups, groupSummary]);

  const allCount = useMemo(() => {
    if (groupSummary) return groupSummary.all || 0;
    return groups.filter(g => g.status !== "merged").length;
  }, [groups, groupSummary]);

  const completionRate = useMemo(() => {
    const totalVisible = activeCount + completedCount;
    if (totalVisible === 0) return 0;
    return Math.round((completedCount / totalVisible) * 100);
  }, [activeCount, completedCount]);

  // Quick Chapter Progress Modal Handlers
  const handleOpenProgressModal = (group: BibleStudyGroup) => {
    setProgressGroupModal(group);
    setProgressFormData({
      curriculum: group.curriculum || "",
      current_chapter: group.current_chapter || "Chapter 1",
      progress_stage: group.progress_stage || "in_progress",
      progress_notes: group.progress_notes || ""
    });
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressGroupModal) return;

    try {
      setIsSavingProgress(true);
      await api.updateGroup(progressGroupModal.id, {
        curriculum: progressFormData.curriculum,
        current_chapter: progressFormData.current_chapter,
        progress_stage: progressFormData.progress_stage,
        progress_notes: progressFormData.progress_notes
      });

      setGroups(prev =>
        prev.map(g =>
          g.id === progressGroupModal.id
            ? {
              ...g,
              curriculum: progressFormData.curriculum,
              current_chapter: progressFormData.current_chapter,
              progress_stage: progressFormData.progress_stage,
              progress_notes: progressFormData.progress_notes
            }
            : g
        )
      );

      if (selectedGroup && selectedGroup.id === progressGroupModal.id) {
        setSelectedGroup({
          ...selectedGroup,
          curriculum: progressFormData.curriculum,
          current_chapter: progressFormData.current_chapter,
          progress_stage: progressFormData.progress_stage,
          progress_notes: progressFormData.progress_notes
        });
      }

      setIsJoinSuccess(`Chapter progress updated for ${progressGroupModal.name}!`);
      setProgressGroupModal(null);
      loadData();
    } catch (err: any) {
      showAlert("Progress Update Failed", err.message || "Failed to update study chapter", "danger");
    } finally {
      setIsSavingProgress(false);
    }
  };

  // Complete Study Lifecycle Handlers
  const handleOpenCompleteModal = (group: BibleStudyGroup) => {
    const title = group.curriculum || "General Scripture Study";
    const total = group.completed_total_chapters || group.curriculum_total_chapters || getBookTotalChapters(title, studySummary?.topics || []) || 12;
    const current = group.completed_chapter || group.current_chapter || `Chapter ${total}`;
    setCompleteGroupModal(group);
    setCompleteFormData({
      completed_book_title_snapshot: group.completed_book_title_snapshot || title,
      completed_chapter: current,
      completed_total_chapters: total,
      notes: group.progress_notes || ""
    });
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeGroupModal) return;

    try {
      setIsCompleting(true);
      await api.completeGroup(completeGroupModal.id, {
        completed_book_title_snapshot: completeFormData.completed_book_title_snapshot.trim(),
        completed_chapter: completeFormData.completed_chapter.trim(),
        completed_total_chapters: Number(completeFormData.completed_total_chapters) || 12,
        notes: completeFormData.notes.trim()
      });

      setIsJoinSuccess(`"${completeGroupModal.name}" marked as completed! Completion snapshot preserved.`);
      setCompleteGroupModal(null);
      if (selectedGroup?.id === completeGroupModal.id) {
        setSelectedGroup(null);
      }
      loadData();
    } catch (err: any) {
      showAlert("Completion Failed", err.message || "Failed to mark group as completed", "danger");
    } finally {
      setIsCompleting(false);
    }
  };

  // Archive (Soft-Delete) Handlers
  const handleOpenArchiveModal = (group: BibleStudyGroup) => {
    setArchiveGroupModal(group);
    setArchiveReason("");
  };

  const handleArchiveSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!archiveGroupModal) return;

    try {
      setIsArchiving(true);
      await api.archiveGroup(archiveGroupModal.id, {
        reason: archiveReason.trim() || "Group discontinued"
      });

      setIsJoinSuccess(`"${archiveGroupModal.name}" moved to Archived Groups.`);
      setArchiveGroupModal(null);
      if (selectedGroup?.id === archiveGroupModal.id) {
        setSelectedGroup(null);
      }
      if (editingGroupId === archiveGroupModal.id) {
        setIsCreateModalOpen(false);
        setEditingGroupId(null);
      }
      loadData();
    } catch (err: any) {
      showAlert("Archiving Failed", err.message || "Failed to archive Bible study group", "danger");
    } finally {
      setIsArchiving(false);
    }
  };

  // Restore Group Handlers
  const handleOpenRestoreModal = (group: BibleStudyGroup) => {
    setRestoreGroupModal(group);
  };

  const handleRestoreSubmit = async () => {
    if (!restoreGroupModal) return;

    try {
      setIsRestoring(true);
      await api.restoreGroup(restoreGroupModal.id);
      setIsJoinSuccess(`"${restoreGroupModal.name}" restored to Active Small Groups!`);
      setRestoreGroupModal(null);
      if (selectedGroup?.id === restoreGroupModal.id) {
        setSelectedGroup(null);
      }
      loadData();
    } catch (err: any) {
      showAlert("Restore Failed", err.message || "Failed to restore Bible study group", "danger");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleOpenRescheduleModal = (group: BibleStudyGroup) => {
    setRescheduleGroupModal(group);
  };

  const handleOpenCreateModal = () => {
    setIsScheduleSuggestionsOpen(false);
    setAppliedScheduleSignature(null);
    setSelectedLeaderId(null);
    setEditingGroupId(null);
    setSelectedMemberIds([]);
    setMemberQuery("");
    setIsMemberDropdownOpen(false);
    setIsCustomLocation(false);
    setCustomLocationText("");
    const initialMin = isRestricted && allowedMinistries.length > 0 ? String(allowedMinistries[0].id) : "";
    const defaultLoc = systemLocations.length > 0 ? systemLocations[0] : "";
    setFormData({
      name: "",
      description: "",
      curriculum: "",
      ministry_id: initialMin,
      leader_name: "",
      leader_contact: "",
      meeting_day: "Wednesday",
      meeting_time_start: "7:00 PM",
      meeting_time_end: "8:30 PM",
      location: defaultLoc,
      category: "General",
      max_capacity: 12,
      current_chapter: "Chapter 1",
      progress_stage: "in_progress",
      progress_notes: ""
    });
    loadLeadersList(initialMin);
    loadMembersForEnrollment();
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (group: BibleStudyGroup) => {
    setIsScheduleSuggestionsOpen(false);
    setAppliedScheduleSignature(null);
    setEditingGroupId(group.id);
    const existingIds = (group.members || [])
      .map((m: any) => m.member_id || m.id)
      .filter((id: any): id is number => typeof id === "number" && id > 0);
    setSelectedMemberIds(existingIds);
    setMemberQuery("");
    setIsMemberDropdownOpen(false);

    const isCustom = Boolean(group.location && !systemLocations.includes(group.location));
    setIsCustomLocation(isCustom);
    setCustomLocationText(isCustom ? (group.location || "") : "");

    let start = "7:00 PM";
    let end = "8:30 PM";
    if (group.meeting_time) {
      if (group.meeting_time.includes("-")) {
        const parts = group.meeting_time.split("-");
        start = parts[0]?.trim() || "7:00 PM";
        end = parts[1]?.trim() || "";
      } else {
        start = group.meeting_time.trim();
        end = "";
      }
    }

    setFormData({
      name: group.name,
      description: group.description || "",
      curriculum: group.curriculum || "",
      ministry_id: group.ministry_id ? String(group.ministry_id) : "",
      leader_name: group.leader_name || "",
      leader_contact: group.leader_contact || "",
      meeting_day: group.meeting_day || "Wednesday",
      meeting_time_start: start,
      meeting_time_end: end,
      location: group.location || "",
      category: group.category || "General",
      max_capacity: group.max_capacity || 12,
      current_chapter: group.current_chapter || "Chapter 1",
      progress_stage: group.progress_stage || "in_progress",
      progress_notes: group.progress_notes || ""
    });
    loadLeadersList(group.ministry_id || undefined);
    loadMembersForEnrollment();
    setSelectedGroup(null);
    setIsCreateModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showAlert("Group Name Required", "Please enter a name for this Bible study group.", "warning");
      return;
    }

    const dupGroup = groups.find(g =>
      g.name.toLowerCase().trim() === formData.name.toLowerCase().trim() &&
      g.id !== editingGroupId &&
      (g.status || "active") === "active"
    );
    if (dupGroup) {
      showAlert("Duplicate Group Name", `An active Bible study group named "${formData.name.trim()}" already exists.`, "warning");
      return;
    }

    if (!formData.leader_name.trim()) {
      showAlert("Leader Required", "Please assign a leader for this group.", "warning");
      return;
    }

    if (!formData.location.trim()) {
      showAlert("Location Required", "Please specify the meeting location or room.", "warning");
      return;
    }

    const maxCap = Number(formData.max_capacity) || 12;
    if (selectedMemberIds.length > maxCap) {
      showAlert(
        "Max Capacity Exceeded",
        `You have enrolled ${selectedMemberIds.length} members, but the max capacity is set to ${maxCap}. Please increase the Max Capacity or adjust the enrolled members.`,
        "warning"
      );
      return;
    }

    try {
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        curriculum: formData.curriculum.trim(),
        ministry_id: formData.ministry_id ? Number(formData.ministry_id) : null,
        leader_name: formData.leader_name.trim(),
        leader_contact: formData.leader_contact.trim(),
        assistant_leader_name: null,
        assistant_leader_contact: null,
        meeting_day: formData.meeting_day,
        meeting_time: formData.meeting_time_end
          ? `${formData.meeting_time_start} - ${formData.meeting_time_end}`
          : formData.meeting_time_start,
        location: formData.location.trim(),
        category: formData.category,
        max_capacity: maxCap,
        current_chapter: formData.current_chapter.trim() || "Chapter 1",
        progress_stage: formData.progress_stage || "in_progress",
        progress_notes: formData.progress_notes.trim(),
        member_ids: selectedMemberIds
      };

      if (editingGroupId) {
        await api.updateGroup(editingGroupId, payload);
        setIsJoinSuccess(`Small Group"${formData.name.trim()}" updated successfully!`);
      } else {
        await api.createGroup(payload);
        setIsJoinSuccess(`New Small Group"${formData.name.trim()}" created successfully!`);
      }

      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      showAlert("Save Group Failed", err.message || "Failed to save Bible study group", "danger");
    }
  };

  const handleToggleMember = (memId: number) => {
    setSelectedMemberIds(prev => {
      const isCurrentlySelected = prev.includes(memId);
      if (isCurrentlySelected) {
        return prev.filter(id => id !== memId);
      }
      const maxCap = Number(formData.max_capacity) || 12;
      if (prev.length >= maxCap) {
        showToast(`Max capacity reached (${maxCap} members). Increase Max Capacity to add more disciples.`, "error");
        return prev;
      }
      return [...prev, memId];
    });
  };

  const cleanUser = user ? user.name.replace(/\(.*?\)/g, "").trim().toLowerCase() : "";
  const userEmail = user ? user.email.trim().toLowerCase() : "";
  const userUsername = user?.username ? user.username.trim().toLowerCase() : "";
  const userMemberId = (user as any)?.member_id;
  const userLinkedName = ((user as any)?.linked_member_name || "").trim().toLowerCase();

  const isUserDesignatedInGroup = (g: BibleStudyGroup) => {
    if (!user) return false;
    const cleanLeader = (g.leader_name || "").replace(/\(.*?\)/g, "").trim().toLowerCase();
    if (cleanLeader) {
      if (cleanUser === cleanLeader || cleanUser.includes(cleanLeader) || cleanLeader.includes(cleanUser)) return true;
      if (userLinkedName && (userLinkedName === cleanLeader || userLinkedName.includes(cleanLeader) || cleanLeader.includes(userLinkedName))) return true;
    }
    const cleanContact = (g.leader_contact || "").trim().toLowerCase();
    if (cleanContact && (cleanContact === userEmail || cleanContact === userUsername)) return true;
    if (g.members && g.members.length > 0) {
      return g.members.some((m: any) => {
        if (userMemberId && m.member_id === userMemberId) return true;
        const mName = (m.member_name || `${m.first_name || ""} ${m.last_name || ""}`).trim().toLowerCase();
        return mName && (mName === cleanUser || cleanUser.includes(mName) || mName.includes(cleanUser));
      });
    }
    return false;
  };

  const isUserLeaderOfGroup = (g: BibleStudyGroup) => {
    if (!user) return false;
    const cleanLeader = (g.leader_name || "").replace(/\(.*?\)/g, "").trim().toLowerCase();
    if (cleanLeader && (cleanUser === cleanLeader || cleanUser.includes(cleanLeader) || cleanLeader.includes(cleanUser))) return true;
    if (userLinkedName && (userLinkedName === cleanLeader || userLinkedName.includes(cleanLeader) || cleanLeader.includes(userLinkedName))) return true;
    const cleanContact = (g.leader_contact || "").trim().toLowerCase();
    if (cleanContact && (cleanContact === userEmail || cleanContact === userUsername)) return true;

    return false;
  };

  const filteredGroups = useMemo(() => {
    if (serverPaged) return groups;
    return groups.filter(g => {
      const s = g.status || "active";
      // Merged source groups are internal DB history only: never display on main page
      if (s === "merged") return false;

      // Status tab filters
      if (statusFilter === "active" && s !== "active") return false;
      if (statusFilter === "completed" && s !== "completed") return false;
      if (statusFilter === "archived" && s !== "archived") return false;
      // statusFilter === "all" includes active, completed, and archived

      if (filterMinistry && String(g.ministry_id) !== filterMinistry) return false;
      if (selectedCategory !== "all" && g.category !== selectedCategory) return false;
      if (filterDay !== "all" && filterDay !== "All Days" && g.meeting_day !== filterDay) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        g.name.toLowerCase().includes(q) ||
        g.leader_name.toLowerCase().includes(q) ||
        (g.curriculum && g.curriculum.toLowerCase().includes(q)) ||
        (g.completed_book_title_snapshot && g.completed_book_title_snapshot.toLowerCase().includes(q)) ||
        (g.location && g.location.toLowerCase().includes(q)) ||
        (g.description && g.description.toLowerCase().includes(q)) ||
        (g.archive_reason && g.archive_reason.toLowerCase().includes(q)) ||
        (g.archived_by_name && g.archived_by_name.toLowerCase().includes(q)) ||
        (g.source_group_names && g.source_group_names.toLowerCase().includes(q))
      );
    });
  }, [groups, statusFilter, filterMinistry, selectedCategory, filterDay, searchQuery, serverPaged]);
  const resultTotal = serverPaged ? serverTotal : filteredGroups.length;
  const visibleGroups = serverPaged ? filteredGroups : filteredGroups.slice((page - 1) * pageSize, page * pageSize);

  const totalMembersEnrolled = useMemo(() => {
    if (groupSummary) return groupSummary.enrolled || 0;
    // Total enrolled across active groups
    return groups
      .filter(g => (g.status || "active") === "active")
      .reduce((sum, g) => sum + (g.current_member_count || (g.members ? g.members.length : 0)), 0);
  }, [groups, groupSummary]);

  const canCreate = user?.role_name === "Admin" || user?.role_name === "Pastor" || user?.role_name === "Coordinator" || user?.role_name === "IT Admin";

  const guideData = useGuideDataState("groups", { loading, count: filteredGroups.length, filtered: groups.length > 0 || Boolean(searchQuery || filterMinistry || selectedCategory !== "all" || filterDay !== "all"), retry: loadData });

  if (loading && !hasLoaded) {
    return <BibleStudyPageSkeleton />;
  }

  return (
    <div className="bible-study-page study-design directory-design space-y-6">
      {/* Toast Notification */}
      {isJoinSuccess && (
        <div className="bg-sage-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between text-xs font-medium animate-bounce-subtle">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-amber-300" />
            <span>{isJoinSuccess}</span>
          </div>
          <button onClick={() => setIsJoinSuccess(null)} className="p-1 hover:text-gray-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Hero Banner */}
      <PageHeader icon={<BookOpen />} title={<>Bible Study & Discipleship Groups</>}
        description={<>Small group fellowships, Scripture study circles, home meetings, and discipleship tracks.</>}
        meta={<>{activeCount} active groups</>}
        actions={<div className="study-header-actions">
          {canCreate && <Button onClick={handleOpenCreateModal} data-guide="group-create" variant="primary"><Plus size={16} />New Bible Study Group</Button>}
          <ActionMenu label="More group actions" items={[
            { label: "Transitions Log", icon: <History />, onClick: () => { setHistoryGroup(null); setIsGlobalHistoryOpen(true); } },
            { label: `Completed Groups (${completedCount})`, icon: <Award />, onClick: () => setStatusFilter("completed") },
            ...(canCreate ? [{ label: "Merge / Transition Groups", guide: "group-transition", icon: <GitMerge />, onClick: () => setIsTransitionModalOpen(true) }] : []),
          ]} />
        </div>} />

      {/* Group summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Small Groups" value={activeCount} icon={<BookOpen />} description="Operational discipleship circles" onClick={() => setStatusFilter("active")} selected={statusFilter === "active"} />
        <StatCard label="Total Enrolled Members" value={totalMembersEnrolled} icon={<Users />} tone="amber" description="Discipleship participation" />
        <StatCard label="Average Group Size" value={activeCount > 0 ? Math.round(totalMembersEnrolled / activeCount) : 0} valueHint="members" icon={<HeartHandshake />} tone="sage" description="Target capacity: 10-15" />
        <StatCard label="Completed Studies" value={completedCount} valueHint="Groups" icon={<CheckCheck />} tone="emerald" description={completionRate + "% · View completed studies →"} onClick={() => setStatusFilter("completed")} selected={statusFilter === "completed"} />
      </div>

      {/* Multi-Level Filter Toolbar */}
      <FilterPanel title="Bible study filters" summary={[statusFilter, selectedCategory !== "all" && selectedCategory, filterDay !== "all" && filterDay, searchQuery].filter(Boolean).join(" · ")}>
        <div className="filter-panel-layout bg-white p-4 rounded-2xl border border-indigo-100/80 shadow-2xs space-y-3.5">
        <div className="study-filter-heading">
          <label className="flex items-center gap-2 text-xs text-muted"><Filter size={14} />Category
            <select aria-label="Filter group category" value={selectedCategory} onChange={event => setSelectedCategory(event.target.value)} className="ui-input">
              {categories.map(cat => <option key={cat} value={cat === "All" ? "all" : cat}>{cat}</option>)}
            </select>
          </label>
          {(selectedCategory !== "all" || filterDay !== "all" || filterMinistry !== initialMinistry || searchQuery || statusFilter !== "active") &&
            <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory("all"); setFilterDay("all"); setFilterMinistry(initialMinistry); setSearchQuery(""); setStatusFilter("active"); }}>Clear filters</Button>}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Status Filter Pills: Active | Completed | Archived | All */}
            <div data-guide="groups-status" className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-2xl border border-gray-200">
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                aria-pressed={statusFilter === "active"}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === "active" ? "bg-indigo text-white shadow-2xs" : "text-charcoal/70 hover:text-charcoal"
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                aria-pressed={statusFilter === "completed"}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === "completed" ? "bg-emerald-600 text-white shadow-2xs" : "text-charcoal/70 hover:text-charcoal"
                }`}
              >
                Completed ({completedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("archived")}
                aria-pressed={statusFilter === "archived"}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === "archived" ? "bg-slate-700 text-white shadow-2xs" : "text-charcoal/70 hover:text-charcoal"
                }`}
              >
                Archived ({archivedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                aria-pressed={statusFilter === "all"}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  statusFilter === "all" ? "bg-charcoal text-white shadow-2xs" : "text-charcoal/70 hover:text-charcoal"
                }`}
              >
                All ({allCount})
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo shrink-0" />
              <select
                aria-label="Filter group ministry"
                value={filterMinistry}
                onChange={(e) => setFilterMinistry(e.target.value)}
                disabled={isRestricted && allowedMinistries.length <= 1}
                className="bg-[var(--surface-2)] px-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo font-medium text-indigo cursor-pointer disabled:opacity-90 disabled:cursor-not-allowed"
              >
                {!isRestricted && <option value=""> All Ministries</option>}
                {allowedMinistries.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} Ministry</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <select
                aria-label="Filter group meeting day"
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="bg-[var(--surface-2)] px-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo font-medium text-charcoal cursor-pointer"
              >
                {daysOfWeek.map((day) => (
                  <option key={day} value={day === "All Days" ? "all" : day}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input data-guide="groups-search"
              aria-label="Search Bible study groups"
              type="text"
              placeholder="Search by topic, leader, room, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--surface-2)] pl-9 pr-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo font-medium"
            />
          </div>
        </div>
      </div>
      </FilterPanel>

      {/* Groups Grid */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-indigo-100 text-center space-y-3 shadow-2xs">
          <BookOpen className="w-10 h-10 text-charcoal/30 mx-auto" />
          <h3 className="text-sm font-semibold text-charcoal">
            {statusFilter === "completed"
              ? "No completed Bible Study Groups yet."
              : statusFilter === "archived"
              ? "No archived Bible Study Groups."
              : statusFilter === "active"
              ? "No active Bible Study Groups."
              : "No Bible Study Groups Found"}
          </h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {statusFilter === "completed"
              ? "Groups that finish their curriculum track will appear here with permanent progress snapshots."
              : statusFilter === "archived"
              ? "Archived groups and soft-deleted records will appear here and can be restored at any time."
              : "Try adjusting your category, status, ministry, or day filters, or schedule a new Bible study group."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleGroups.map((g) => {
            const memberCount = g.current_member_count || (g.members ? g.members.length : 0);
            const capacityPercent = Math.min(100, Math.round((memberCount / (g.max_capacity || 12)) * 100));
            const isLeaderOfThis = isUserLeaderOfGroup(g);
            const isDesignatedOfThis = isUserDesignatedInGroup(g);
            const isCompleted = g.status === "completed";
            const isArchived = g.status === "archived";

            return <article key={g.id} className="study-group-card" aria-label={g.name}>
              <div className="study-card-labels">
                <Badge variant="neutral" className="uppercase">{g.category}</Badge>
                <Badge variant="neutral" title={g.ministry_name || "All-Church"}>{g.ministry_name || "All-Church"}</Badge>
                {isCompleted ? <Badge variant="success">Completed</Badge> : isArchived ? <Badge variant="neutral">Archived</Badge>
                  : <Badge variant={g.progress_stage === "intro" ? "info" : "warning"}>{getProgressStageBadge(g.progress_stage).label}</Badge>}
                {!isArchived && isLeaderOfThis && <Badge variant="neutral">Led by You</Badge>}
                {!isArchived && !isLeaderOfThis && isDesignatedOfThis && <Badge variant="neutral">Your Group</Badge>}
                {(g.created_transition_id || g.source_group_names) && <Badge variant="neutral" title={`Merged from: ${g.source_group_names || "Previous groups"}`}><GitMerge size={12} />Merged Group</Badge>}
              </div>
              <h3 title={g.name}>{g.name}</h3>
              <div className="study-card-curriculum"><BookOpen size={16} /><span title={g.completed_book_title_snapshot || g.curriculum || "Scripture Study"}>{g.completed_book_title_snapshot || g.curriculum || "Scripture Study"} · {g.completed_chapter || g.current_chapter || "Chapter 1"}</span></div>
              <p className="study-pacing-notice" title={g.progress_notes || "No lesson notice logged"}><BookmarkCheck size={14} /><span>{g.progress_notes || "No lesson notice logged"}</span></p>
              {g.source_group_names && <p className="study-truncate text-xs text-muted" title={`Merged from: ${g.source_group_names}`}>Merged from: {g.source_group_names}</p>}
              {isCompleted && <p className="text-xs text-muted">Completed: {g.completed_at ? formatDisplayDate(g.completed_at) : "Recently Completed"}</p>}
              {isArchived && <div className="text-xs text-muted space-y-1"><p>Archived: {formatDisplayDate(g.archived_at)} · {g.archived_by_name || "Pastor / Admin"}</p>{g.archive_reason && <p>Reason: {g.archive_reason}</p>}</div>}
              {!isCompleted && !isArchived && <div className="study-card-actions">
                <Button variant="secondary" size="sm" data-guide="group-reschedule" onClick={() => handleOpenRescheduleModal(g)}><CalendarClock size={14} />Reschedule</Button>
                <Button variant="secondary" size="sm" data-guide="group-progress" onClick={() => handleOpenProgressModal(g)}><BookmarkCheck size={14} />Update Chapter</Button>
                {canCreate && <ActionMenu label={`More actions for ${g.name}`} items={[
                  { label: "Complete Study", guide: "group-complete", icon: <Award />, onClick: () => handleOpenCompleteModal(g) },
                  { label: "Archive Group", guide: "group-archive", icon: <Archive />, destructive: true, onClick: () => handleOpenArchiveModal(g) },
                ]} />}
              </div>}
              {g.is_rescheduled && <div className="study-reschedule-note"><Badge variant="info">Next Session Rescheduled</Badge><p>{formatDisplayDate(g.rescheduled_date)}{g.rescheduled_time ? ` · ${g.rescheduled_time}` : ""}</p>{g.reschedule_reason && <p title={g.reschedule_reason}>Notice: {g.reschedule_reason}</p>}</div>}
              {g.description && <p className="study-card-description" title={g.description}>{g.description}</p>}
              <div className="study-card-schedule text-xs text-muted">
                {!isCompleted && !isArchived && <><p><Calendar size={14} />Meets every {g.meeting_day} at {g.meeting_time}</p><p title={g.location}><MapPin size={14} />{g.location}</p></>}
                <p><ShieldCheck size={14} />Leader: <strong>{g.leader_name}</strong></p>
              </div>
              <footer className="study-card-footer">
                <div className="text-xs text-muted flex justify-between gap-2"><span>Roster: {memberCount} of {g.max_capacity || 12} Enrolled</span><span>{memberCount > (g.max_capacity || 12) ? "Over Capacity" : `${capacityPercent}% Full`}</span></div>
                <div className="study-capacity-bar"><span style={{ width: `${capacityPercent}%` }} /></div>
                <Button variant="secondary" size="sm" onClick={() => setSessionHistoryGroup(g)}><Calendar size={14} />Session History</Button>
                <div className="study-footer-row">
                  <Button variant="primary" size="sm" data-guide="group-details" onClick={() => setSelectedGroup(g)}><Users size={14} />{isCompleted || isArchived ? "View Details" : `View Roster (${memberCount})`}</Button>
                  <Button variant="secondary" size="icon" data-guide="group-history" aria-label={`Transition history for ${g.name}`} title="View Group Transition History" onClick={() => setHistoryGroup(g)}><History size={16} /></Button>
                  {!isCompleted && !isArchived && canCreate && <Button variant="secondary" size="icon" title="Edit Group" aria-label={`Edit ${g.name}`} onClick={() => handleOpenEditModal(g)}><Edit size={16} /></Button>}
                  {isCompleted && canCreate && <Button variant="secondary" size="icon" data-guide="group-archive" title="Archive Group" aria-label={`Archive ${g.name}`} onClick={() => handleOpenArchiveModal(g)}><Archive size={16} /></Button>}
                  {isArchived && canCreate && <Button variant="secondary" size="sm" onClick={() => handleOpenRestoreModal(g)}><RotateCcw size={14} />Restore Group</Button>}
                </div>
              </footer>
            </article>;
          })}
        </div>
      )}

      <Pagination label="groups" page={page} pageSize={pageSize} total={resultTotal} onPageChange={setPage} onPageSizeChange={setPageSize} loading={loading} />

      {/* GROUP DETAILS & ROSTER MODAL */}
      {selectedGroup && <GroupDetailsModal key={selectedGroup.id} group={selectedGroup} topics={studySummary?.topics || studySummary?.all || []}
        stageLabel={getProgressStageBadge(selectedGroup.progress_stage).label} onUpdateProgress={() => { handleOpenProgressModal(selectedGroup); setSelectedGroup(null); }} onClose={() => setSelectedGroup(null)}
        footer={<div className="study-details-footer">
          <div className="study-footer-row">
            <Button variant="secondary" size="sm" title="Weekly attendance, lessons covered and session notes" onClick={() => { setSessionHistoryGroup(selectedGroup); setSelectedGroup(null); }}><Calendar size={14} />Session History</Button>
            <Button variant="secondary" size="sm" data-guide="group-history" title="Leadership, group merges and transition history" onClick={() => setHistoryGroup(selectedGroup)}><History size={14} />Timeline</Button>
          </div>
          <div className="study-footer-row">
            {selectedGroup.status === "active" && canCreate && <Button variant="primary" size="sm" data-guide="group-edit" onClick={() => handleOpenEditModal(selectedGroup)}><Edit size={14} />Edit Group</Button>}
            {(selectedGroup.status === "active" || canCreate) && <ActionMenu label="More group detail actions" items={[
              ...(selectedGroup.status === "active" ? [{ label: "Reschedule", guide: "group-reschedule", icon: <CalendarClock />, onClick: () => { const g = selectedGroup; setSelectedGroup(null); handleOpenRescheduleModal(g); } }] : []),
              ...(selectedGroup.status === "active" && canCreate ? [{ label: "Complete Study", guide: "group-complete", icon: <Award />, onClick: () => { const g = selectedGroup; setSelectedGroup(null); handleOpenCompleteModal(g); } }] : []),
              ...(selectedGroup.status !== "archived" && canCreate ? [{ label: "Archive Group", guide: "group-archive", icon: <Archive />, destructive: true, onClick: () => { const g = selectedGroup; setSelectedGroup(null); handleOpenArchiveModal(g); } }] : []),
              ...(selectedGroup.status === "archived" && canCreate ? [{ label: "Restore Group", icon: <RotateCcw />, onClick: () => { const g = selectedGroup; setSelectedGroup(null); handleOpenRestoreModal(g); } }] : []),
            ]} />}
          </div>
        </div>} />}

      {/* CREATE / EDIT GROUP MODAL */}
      {isCreateModalOpen && !editingGroupId && isScheduleSuggestionsOpen && <ScheduleSuggestionsModal
        members={scheduleMembers}
        leader={scheduleLeader}
        initialDuration={(parseScheduleTime(formData.meeting_time_end) ?? 0) - (parseScheduleTime(formData.meeting_time_start) ?? 0)}
        onClose={() => setIsScheduleSuggestionsOpen(false)}
        onApply={suggestion => {
          setFormData(previous => ({ ...previous, meeting_day: suggestion.day,
            meeting_time_start: formatScheduleTime(suggestion.start), meeting_time_end: formatScheduleTime(suggestion.end) }));
          setAppliedScheduleSignature(scheduleSignature);
          setIsScheduleSuggestionsOpen(false);
        }}
      />}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-2xl max-w-xl md:max-w-2xl lg:max-w-3xl w-full p-6 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto border border-indigo-100">
            <div data-modal-header className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-charcoal flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo" />
                <span>{editingGroupId ? "Edit Bible Study Group" : "Create New Bible Study Small Group"}</span>
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 text-muted hover:bg-gray-100 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-charcoal/70 mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Young Professionals Book of Romans"
                  data-guide="group-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-charcoal/70 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-indigo"
                  >
                    {categories.filter(c => c !== "All").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-charcoal/70 mb-1">Ministry Scope</label>
                  <select
                    value={formData.ministry_id}
                    onChange={(e) => {
                      const minId = e.target.value;
                      setFormData({ ...formData, ministry_id: minId });
                      loadLeadersList(minId);
                      loadMembersForEnrollment(minId);
                    }}
                    disabled={isRestricted && allowedMinistries.length <= 1}
                    className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-indigo disabled:opacity-90 disabled:cursor-not-allowed"
                  >
                    {!isRestricted && <option value=""> All-Church</option>}
                    {allowedMinistries.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} Ministry</option>
                    ))}
                  </select>
                </div>
              </div>

              <div ref={curriculumRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-charcoal/70">Book / Study Topic</label>
                  {formData.curriculum && (
                    <span className="text-[12px] text-indigo-600 font-medium">Select or type custom</span>
                  )}
                </div>
                <div className="relative">
                  <input data-guide="group-topic"
                    type="text"
                    placeholder="Search books & topics (e.g. Gospel of John, Romans, Sacred Marriage)"
                    value={formData.curriculum}
                    onFocus={(e) => {
                      e.target.select();
                      setCurriculumQuery("");
                      setIsCurriculumDropdownOpen(true);
                    }}
                    onClick={() => {
                      setCurriculumQuery("");
                      setIsCurriculumDropdownOpen(true);
                    }}
                    onChange={(e) => {
                      setFormData({ ...formData, curriculum: e.target.value });
                      setCurriculumQuery(e.target.value);
                      setIsCurriculumDropdownOpen(true);
                    }}
                    className="w-full bg-[var(--surface-2)] p-2.5 pr-14 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                  {formData.curriculum && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData(prev => ({ ...prev, curriculum: "" }));
                        setCurriculumQuery("");
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
                        setCurriculumQuery("");
                      }
                      setIsCurriculumDropdownOpen(!isCurriculumDropdownOpen);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-indigo p-0.5 cursor-pointer"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCurriculumDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {isCurriculumDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100">
                    <div className="p-2 bg-indigo-50/70 text-[12px] font-medium text-indigo-900 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                      <span>Available Books & Topics ({filteredCurricula.length})</span>
                      <span className="text-[12px] text-indigo-600 font-normal">Click to choose</span>
                    </div>
                    {filteredCurricula.length === 0 ? (
                      <div className="p-3 text-center text-muted text-[12px]">
                        No matching book or topic found. You can keep typing custom.
                      </div>
                    ) : (
                      filteredCurricula.map((item, idx) => (
                        <button
                          key={`${item.title}-${idx}`}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, curriculum: item.title }));
                            setCurriculumQuery("");
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
                          {formData.curriculum === item.title && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Leader Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div ref={leaderRef} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-charcoal/70">Leader *</label>
                  </div>
                  <div className="relative">
                    <input data-guide="group-leader"
                      type="text"
                      required
                      placeholder="Search leader (e.g. Pastor, Elder, Sister)"
                      value={formData.leader_name}
                      onFocus={(e) => {
                        e.target.select();
                        setLeaderQuery("");
                        setIsLeaderDropdownOpen(true);
                      }}
                      onClick={() => {
                        setLeaderQuery("");
                        setIsLeaderDropdownOpen(true);
                      }}
                      onChange={(e) => {
                        setFormData({ ...formData, leader_name: e.target.value });
                        setSelectedLeaderId(null);
                        setLeaderQuery(e.target.value);
                        setIsLeaderDropdownOpen(true);
                      }}
                      className="w-full bg-[var(--surface-2)] p-2.5 pr-14 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => {
                        if (!isLeaderDropdownOpen) {
                          setLeaderQuery("");
                        }
                        setIsLeaderDropdownOpen(!isLeaderDropdownOpen);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-indigo p-0.5 cursor-pointer"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isLeaderDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {isLeaderDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100">
                      <div className="p-2 bg-indigo-50/70 text-[12px] font-medium text-indigo-900 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                        <span>Church Leaders & Members ({filteredLeaders.length})</span>
                      </div>
                      {filteredLeaders.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              leader_name: l.name,
                              leader_contact: l.contact || prev.leader_contact
                            }));
                            setSelectedLeaderId(l.id);
                            setLeaderQuery("");
                            setIsLeaderDropdownOpen(false);
                          }}
                          className="w-full text-left p-2.5 hover:bg-indigo-50/60 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-medium text-charcoal group-hover:text-indigo text-xs">
                              {l.name}
                            </div>
                            <div className="text-[12px] text-muted mt-0.5 flex items-center gap-1.5">
                              <span className="bg-gray-100 px-1.5 py-0.2 rounded text-[12px] font-medium text-charcoal/80">
                                {l.role_name}
                              </span>
                              {l.contact && <span className="truncate">• {l.contact}</span>}
                            </div>
                          </div>
                          {formData.leader_name === l.name && (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-charcoal/70 mb-1">Leader Contact</label>
                  <input
                    type="text"
                    placeholder="e.g. 0917-123-4567 or email"
                    value={formData.leader_contact}
                    onChange={(e) => setFormData({ ...formData, leader_contact: e.target.value })}
                    className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                </div>
              </div>

              {!editingGroupId && <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-charcoal/70">Meeting schedule</span>
                  <Button ref={scheduleTriggerRef} size="sm" disabled={!selectedMemberIds.length || membersLoadError} onClick={() => {
                    setIsMemberDropdownOpen(false);
                    setIsScheduleSuggestionsOpen(true);
                  }}>
                    <CalendarClock aria-hidden="true" className="w-4 h-4" /> Find Best Schedule
                  </Button>
                </div>
                {!selectedMemberIds.length && <p className="text-muted text-xs">Select members below to see suggested schedules.</p>}
                {membersLoadError && <p className="text-rose-700 text-xs" role="alert">Could not load member schedules. <button type="button" className="underline" onClick={() => loadMembersForEnrollment(filterMinistry)}>Try again</button></p>}
                {appliedScheduleSignature && appliedScheduleSignature !== scheduleSignature && <p className="text-amber-800 text-xs" role="status">Members, leader, or recorded schedules changed. Check schedule suggestions again.</p>}
              </div>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div data-guide="group-schedule">
                  <label className="block font-medium text-charcoal/70 mb-1">Meeting Day *</label>
                  <select
                    value={formData.meeting_day}
                    onChange={(e) => setFormData({ ...formData, meeting_day: e.target.value })}
                    className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium"
                  >
                    {daysOfWeek.filter(d => d !== "All Days").map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-charcoal/70 mb-1">Start Time *</label>
                  <TimePickerInput
                    value={formData.meeting_time_start}
                    onChange={(val) => setFormData({ ...formData, meeting_time_start: val })}
                  />
                </div>

                <div>
                  <label className="block font-medium text-charcoal/70 mb-1">End Time</label>
                  <TimePickerInput
                    value={formData.meeting_time_end}
                    onChange={(val) => setFormData({ ...formData, meeting_time_end: val })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-charcoal/70 text-xs">Location / Room *</label>
                    <span className="text-[12px] text-indigo font-medium">Database Rooms</span>
                  </div>
                  <select data-guide="group-location"
                    required
                    value={isCustomLocation ? "__custom__" : formData.location}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setIsCustomLocation(true);
                        setFormData({ ...formData, location: customLocationText });
                      } else {
                        setIsCustomLocation(false);
                        setFormData({ ...formData, location: e.target.value });
                      }
                    }}
                    className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-charcoal text-xs cursor-pointer"
                  >
                    <option value="">-- Choose Church Room / Location --</option>
                    {systemLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                    {formData.location && !systemLocations.includes(formData.location) && (
                      <option data-guide="group-location" value={formData.location}>
                        {formData.location} (Current Location)
                      </option>
                    )}
                    <option value="__custom__">+ Custom / Off-Site Location...</option>
                  </select>

                  {isCustomLocation && (
                    <input
                      type="text"
                      required
                      placeholder="Type custom location / home address..."
                      value={customLocationText}
                      onChange={(e) => {
                        setCustomLocationText(e.target.value);
                        setFormData({ ...formData, location: e.target.value });
                      }}
                      className="w-full mt-2 bg-white p-2.5 rounded-xl border border-indigo-300 focus:outline-none focus:border-indigo font-medium text-charcoal text-xs animate-in fade-in"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-medium text-charcoal/70 mb-1 text-xs">Max Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.max_capacity}
                    onChange={(e) => setFormData({ ...formData, max_capacity: Number(e.target.value) || 12 })}
                    className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs"
                  />
                </div>
              </div>

              {/* Enrollment section */}
              <div ref={memberRef} className="space-y-2 p-3 bg-indigo-50/40 rounded-2xl border border-indigo-100/90">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Users className="w-4 h-4 text-indigo shrink-0" />
                    <label className="block font-medium text-charcoal/80 text-xs">
                      Enroll Church Members ({selectedMemberIds.length} of {formData.max_capacity || 12} Selected)
                    </label>
                    {selectedMemberIds.length >= (Number(formData.max_capacity) || 12) && (
                      <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Full (Max {formData.max_capacity || 12})</span>
                      </span>
                    )}
                  </div>
                  {selectedMemberIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedMemberIds([])}
                      className="text-[12px] text-rose-600 font-medium hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Search Input & Ministry Filter Row */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    <input data-guide="group-members"
                      type="text"
                      placeholder="Search unenrolled members to add..."
                      value={memberQuery}
                      onChange={(e) => {
                        setMemberQuery(e.target.value);
                        setIsMemberDropdownOpen(true);
                      }}
                      onFocus={() => setIsMemberDropdownOpen(true)}
                      className="w-full bg-white pl-8 pr-8 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-indigo"
                    />
                    {memberQuery && (
                      <button
                        type="button"
                        onClick={() => setMemberQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-rose-500 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Ministry Filter */}
                  <div className="relative shrink-0">
                    <select
                      value={memberMinistryFilter}
                      onChange={(e) => {
                        setMemberMinistryFilter(e.target.value);
                        setIsMemberDropdownOpen(true);
                      }}
                      className="px-2.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-indigo focus:outline-none focus:border-indigo cursor-pointer shadow-2xs"
                    >
                      <option value="all"> All Ministries</option>
                      {memberMinistries.filter(m => m !== "all").map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Candidate Members List (Inline Expandable / Overlap Safe) */}
                {isMemberDropdownOpen && (
                  <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm max-h-52 overflow-y-auto divide-y divide-gray-100 animate-in fade-in">
                    <div className="p-2 bg-indigo-50/60 text-[12px] font-medium text-indigo-900 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                      <div className="flex items-center gap-1.5">
                        <span>Available Members ({filteredMembers.length})</span>
                        {selectedMemberIds.length >= (Number(formData.max_capacity) || 12) && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-medium text-[12px]">
                            Capacity Full
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMemberDropdownOpen(false)}
                        className="text-[12px] text-indigo-600 hover:text-indigo-900 font-medium hover:underline cursor-pointer"
                      >
                        Hide List
                      </button>
                    </div>

                    {selectedMemberIds.length >= (Number(formData.max_capacity) || 12) && (
                      <div className="p-2.5 bg-amber-50/90 border-b border-amber-200 text-amber-950 text-[12px] font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Max capacity ({formData.max_capacity || 12}) reached. Increase capacity or remove a member to add more.</span>
                      </div>
                    )}

                    {filteredMembers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted">
                        {memberQuery || memberMinistryFilter !== "all"
                          ? `No available members found matching the filter.`
                          : "No unenrolled members available."}
                      </div>
                    ) : (
                      filteredMembers.map((mem) => {
                        const isSelected = selectedMemberIds.includes(mem.id);
                        const isAtMax = selectedMemberIds.length >= (Number(formData.max_capacity) || 12);
                        return (
                          <div
                            key={mem.id}
                            onClick={() => handleToggleMember(mem.id)}
                            className={`p-2.5 hover:bg-indigo-50/70 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected ? "bg-indigo-50/80 font-medium" : ""
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs text-charcoal font-medium truncate">{mem.name}</div>
                              {mem.ministry_name && (
                                <div className="text-[12px] text-indigo-700/70">{mem.ministry_name}</div>
                              )}
                            </div>
                            <span
                              className={`text-[12px] px-2.5 py-0.5 rounded-full font-medium shrink-0 transition-all ${
                                isSelected
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : isAtMax
                                  ? "bg-amber-100 text-amber-900 border border-amber-200 opacity-90"
                                  : "bg-gray-100 hover:bg-indigo-100 text-charcoal/70"
                              }`}
                            >
                              {isSelected ? <><Check aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Added</> : isAtMax ? `Full (Max ${formData.max_capacity || 12})` : "+ Add"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Display list of all currently enrolled/selected members */}
                {enrolledMembersDetails.length > 0 && (
                  <div className="pt-1.5 space-y-1.5">
                    <div className="text-[12px] font-medium text-muted">
                      Currently Enrolled Disciples ({enrolledMembersDetails.length}):
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-white/90 rounded-xl border border-indigo-100 max-h-36 overflow-y-auto">
                      {enrolledMembersDetails.map((mem) => (
                        <span
                          key={mem.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-charcoal text-xs font-medium shadow-2xs hover:border-rose-300 transition-all"
                        >
                          <span>{mem.name}</span>
                          {mem.ministry_name && (
                            <span className="text-[12px] text-indigo-700/70 font-normal">({mem.ministry_name})</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleMember(mem.id)}
                            className="w-4 h-4 rounded-full hover:bg-rose-100 text-muted hover:text-rose-600 flex items-center justify-center cursor-pointer ml-0.5"
                            title={`Remove ${mem.name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-charcoal/70 mb-1">Description / Group Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Group focus, target audience, study style..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                {editingGroupId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const groupToArchive = groups.find((g) => g.id === editingGroupId);
                      if (groupToArchive) {
                        setIsCreateModalOpen(false);
                        handleOpenArchiveModal(groupToArchive);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                    title="Move this Bible study group to Archived list (can be restored anytime)"
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-600" />
                    <span>Archive Group</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-charcoal hover:bg-gray-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-guide="group-save"
                    className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-medium shadow-md cursor-pointer"
                  >
                    {editingGroupId ? "Save Changes" : "Create Small Group"}
                  </button>
                </div>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ARCHIVE (SOFT-DELETE) CONFIRMATION MODAL */}
      {archiveGroupModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in">
            <div data-modal-header className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center font-medium">
                  <Archive className="w-6 h-6 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-charcoal">Archive Bible Study Group?</h3>
                  <p className="text-xs text-muted font-medium">{archiveGroupModal.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setArchiveGroupModal(null)}
                className="p-1.5 text-muted hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-700 space-y-2">
              <p className="leading-relaxed">
                This group will be removed from the active group list, but its <strong>members, attendance records, curriculum progress, schedules, and history will be preserved</strong>.
              </p>
              <p className="text-[12px] text-slate-500 font-medium"><UIInfo aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> This will not permanently delete the group. It will be moved to <strong>Archived Groups</strong> and can be restored at any time.
              </p>
            </div>

            <form data-guide="group-archive-form" onSubmit={handleArchiveSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-charcoal/80 mb-1">
                  Reason for archiving <span className="text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Study cycle ended, group discontinued, leader relocated..."
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div data-modal-footer className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setArchiveGroupModal(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-xs text-charcoal hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isArchiving}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isArchiving ? "Archiving..." : "Archive Group"}</span>
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* COMPLETE STUDY SNAPSHOT MODAL */}
      {completeGroupModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-emerald-200 animate-in fade-in max-h-[92vh] overflow-y-auto">
            <div data-modal-header className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center justify-center font-medium">
                  <Award className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-charcoal">Complete Bible Study Track</h3>
                  <p className="text-xs text-emerald-900 font-medium">{completeGroupModal.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompleteGroupModal(null)}
                className="p-1.5 text-muted hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
              <p className="font-medium">Celebrate the milestone of finishing this study circle!</p>
              <p className="text-[12px] text-emerald-800">
                This group will move to <strong>Completed Groups</strong> with a permanent snapshot of the finished curriculum and chapter. Full attendance history and roster remain intact.
              </p>
            </div>

            <form data-guide="group-complete-form" onSubmit={handleCompleteSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-charcoal/80 mb-1">Curriculum / Study Title *</label>
                <input
                  type="text"
                  required
                  value={completeFormData.completed_book_title_snapshot}
                  onChange={(e) => setCompleteFormData({ ...completeFormData, completed_book_title_snapshot: e.target.value })}
                  className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 font-medium text-charcoal focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-charcoal/80 mb-1">Finished at (Chapter/Lesson) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chapter 12 of 12"
                    value={completeFormData.completed_chapter}
                    onChange={(e) => setCompleteFormData({ ...completeFormData, completed_chapter: e.target.value })}
                    className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-medium text-charcoal/80 mb-1">Total Chapters *</label>
                  <input
                    type="number"
                    min={1}
                    max={150}
                    required
                    value={completeFormData.completed_total_chapters}
                    onChange={(e) => setCompleteFormData({ ...completeFormData, completed_total_chapters: Number(e.target.value) || 12 })}
                    className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-charcoal/80 mb-1">
                  Final Reflections / Completion Notes <span className="text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Key takeaways, testimony highlights, next study recommendation..."
                  value={completeFormData.notes}
                  onChange={(e) => setCompleteFormData({ ...completeFormData, notes: e.target.value })}
                  className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div data-modal-footer className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompleteGroupModal(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-xs text-charcoal hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCompleting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>{isCompleting ? "Recording..." : "Mark as Completed"}</span>
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* RESTORE GROUP CONFIRMATION MODAL */}
      {restoreGroupModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-emerald-200 animate-in fade-in">
            <div data-modal-header className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center justify-center font-medium">
                  <RotateCcw className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-charcoal">Restore Bible Study Group?</h3>
                  <p className="text-xs text-muted font-medium">{restoreGroupModal.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoreGroupModal(null)}
                className="p-1.5 text-muted hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-2">
              <p className="leading-relaxed">
                Restore <strong>"{restoreGroupModal.name}"</strong> back to <strong>Active Small Groups</strong>? It will immediately reappear in the active directory and active schedules.
              </p>
              <p className="text-[12px] text-emerald-800">
                All previous members, attendance roll-calls, and study progress will be immediately accessible.
              </p>
            </div>

            <div data-modal-footer className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreGroupModal(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-xs text-charcoal hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestoreSubmit}
                disabled={isRestoring}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isRestoring ? "Restoring..." : "Restore to Active"}</span>
              </button>
            </div>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* QUICK UPDATE PROGRESS MODAL */}
      {progressGroupModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 space-y-4">
            <div data-modal-header className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-medium">
                  <BookmarkCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-charcoal">Update Study Chapter</h3>
                  <p className="text-xs text-muted truncate max-w-xs">{progressGroupModal.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProgressGroupModal(null)}
                className="p-1.5 text-muted hover:text-charcoal hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form data-guide="group-progress-form" onSubmit={handleSaveProgress} className="space-y-3.5 text-xs">
              <StudyProgressFields
                value={{ book: progressFormData.curriculum, chapter: progressFormData.current_chapter, stage: progressFormData.progress_stage }}
                onChange={value => setProgressFormData(previous => ({ ...previous, curriculum: value.book, current_chapter: value.chapter, progress_stage: value.stage }))}
                topics={studySummary?.topics || studySummary?.all || []}
                fallbackBook={progressGroupModal.curriculum}
                fallbackChapters={progressGroupModal.curriculum_total_chapters}
                disabled={isSavingProgress}
                readOnlyBook={user?.role_name === "Leader"}
              />

              <LessonNoticeField value={progressFormData.progress_notes}
                onChange={value => setProgressFormData(previous => ({ ...previous, progress_notes: value }))} disabled={isSavingProgress} />

              <div data-modal-footer className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setProgressGroupModal(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-charcoal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProgress}
                  className="px-5 py-2 rounded-xl bg-indigo text-white font-medium shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingProgress ? "Saving..." : "Save Chapter Progress"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* RESCHEDULE MODAL (WITH ROOM AVAILABILITY & DAY-WISE GROUP INSPECTOR) */}
      <BibleStudyRescheduleModal
        isOpen={Boolean(rescheduleGroupModal)}
        onClose={() => setRescheduleGroupModal(null)}
        group={rescheduleGroupModal}
        onSaved={loadData}
        showToast={(msg, type) => {
          if (type === "error") {
            showAlert("Reschedule Error", msg, "danger");
          } else {
            setIsJoinSuccess(msg);
          }
        }}
      />

      {/* COMPLETED GROUPS ARCHIVE MODAL */}
      {isCompletedModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-emerald-100 max-h-[90vh] overflow-y-auto">
            <div data-modal-header className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-medium">
                  <Award className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-charcoal">Completed Bible Study Groups</h3>
                  <p className="text-xs text-muted">{completedCount} groups finished curriculum tracks</p>
                </div>
              </div>
              <button onClick={() => setIsCompletedModalOpen(false)} className="p-1.5 text-muted hover:bg-gray-100 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {groups.filter(g => g.status === "completed" || g.progress_stage === "completed").length === 0 ? (
                <p className="text-xs text-muted text-center py-6">No completed groups yet in this cycle.</p>
              ) : (
                groups.filter(g => g.status === "completed" || g.progress_stage === "completed").map(g => (
                  <div key={g.id} className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-emerald-950">{g.name}</div>
                      <div className="text-[12px] text-emerald-800">
                        {g.completed_book_title_snapshot || g.curriculum} • {g.completed_chapter || g.current_chapter || "Finished"} • Leader: {g.leader_name}
                      </div>
                    </div>
                    <span className="text-[12px] font-medium bg-emerald-600 text-white px-2 py-0.5 rounded-full"><Check aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Completed
                    </span>
                  </div>
                ))
              )}
            </div>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* GROUP TRANSITION WIZARD MODAL */}
      <GroupTransitionModal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        activeGroups={transitionGroups.length ? transitionGroups : groups.filter(g => g.status !== "merged")}
        onTransitionCompleted={(newGroupId, msg) => {
          setIsTransitionModalOpen(false);
          setIsJoinSuccess(msg);
          loadData();
        }}
        systemLocations={systemLocations}
        systemCategories={systemCategories}
        allowedMinistries={allowedMinistries}
      />

      {/* GROUP TRANSITION HISTORY MODAL */}
      {sessionHistoryGroup && <SessionHistoryModal key={sessionHistoryGroup.id} group={sessionHistoryGroup} onClose={() => setSessionHistoryGroup(null)} />}
      <GroupHistoryModal
        isOpen={Boolean(historyGroup) || isGlobalHistoryOpen}
        onClose={() => {
          setHistoryGroup(null);
          setIsGlobalHistoryOpen(false);
        }}
        group={historyGroup}
        onSelectRelatedGroup={(relatedId) => {
          const target = groups.find(g => g.id === relatedId);
          if (target) {
            setHistoryGroup(target);
            setSelectedGroup(target);
          } else {
            api.getGroupById(relatedId).then(group => { setHistoryGroup(group); setSelectedGroup(group); }).catch(() => {});
          }
        }}
      />

      {/* Confirmation Modal */}
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

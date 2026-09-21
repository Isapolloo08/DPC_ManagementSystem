import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { BibleStudyGroup, StudyTopic, StudyTopicsSummary, User } from "../types";
import { TimePickerInput } from "../components/common/TimePickerInput";
import { DatePickerInput } from "../components/common/DatePickerInput";
import { DateTimePickerInput } from "../components/common/DateTimePickerInput";
import { useSocketEvent } from "../socket";
import { BibleStudyPageSkeleton, CardGridSkeleton } from "../components/common/SkeletonLoader";
import { ConfirmationModal, ModalType } from "../components/common/ConfirmationModal";
import { BibleStudyRescheduleModal } from "../components/biblestudy/BibleStudyRescheduleModal";
import {
  BookOpen, Plus, Users, Calendar, Clock, MapPin,
  Search, Filter, CheckCircle2, X, Phone, Sparkles,
  Layers, ShieldCheck, HeartHandshake,
  Award, CheckCheck, Library, BookmarkCheck,
  ChevronDown, User as UserIcon, Check, Edit, FileText, AlertCircle,
  CalendarClock, AlertTriangle
} from "lucide-react";
import { getBookTotalChapters, generateChapterOptions } from "../utils/curriculumHelper";

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

export const BibleStudyPage: React.FC = () => {
  const { user, allowedMinistries, isRestricted, selectedMinistryId } = useAuth();
  const [groups, setGroups] = useState<BibleStudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [studySummary, setStudySummary] = useState<StudyTopicsSummary | null>(null);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);
  const [isJoinSuccess, setIsJoinSuccess] = useState<string | null>(null);

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

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterMinistry, setFilterMinistry] = useState<string>(initialMinistry);
  const [filterDay, setFilterDay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<BibleStudyGroup | null>(null);

  // Quick Chapter Progress Modal State
  const [progressGroupModal, setProgressGroupModal] = useState<BibleStudyGroup | null>(null);
  const [progressFormData, setProgressFormData] = useState({
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
  const [leadersList, setLeadersList] = useState<{ id: string | number; name: string; contact: string; role_name?: string }[]>([]);
  const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false);
  const [isCurriculumDropdownOpen, setIsCurriculumDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  const [customLocationText, setCustomLocationText] = useState("");

  // Group Members Enrollment State
  const [membersList, setMembersList] = useState<{ id: number; name: string; ministry_name?: string; age?: number }[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [memberQuery, setMemberQuery] = useState<string>("");
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);

  const [curriculumQuery, setCurriculumQuery] = useState<string>("");
  const [leaderQuery, setLeaderQuery] = useState<string>("");
  const [locationQuery, setLocationQuery] = useState<string>("");

  const leaderRef = useRef<HTMLDivElement>(null);
  const curriculumRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const memberRef = useRef<HTMLDivElement>(null);

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
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) {
        setIsMemberDropdownOpen(false);
        setMemberQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    loadData();
  }, [filterMinistry, selectedCategory, filterDay]);

  // Real-time synchronization
  useSocketEvent("groups:changed", () => loadData());
  useSocketEvent("members:changed", () => loadData());
  useSocketEvent("lookups:changed", () => loadData());
  useSocketEvent("study_topics:changed", () => loadData());

  const loadData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterMinistry !== "all" && filterMinistry) params.ministry_id = Number(filterMinistry);
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (filterDay !== "all") params.meeting_day = filterDay;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const [groupsRes, studyRes, categoriesRes, locationsRes] = await Promise.all([
        api.getGroups(params),
        api.getStudyTopics().catch(() => null),
        api.getLookups({ type: "bible_study_category" }).catch(() => []),
        api.getLookups({ type: "event_location" }).catch(() => [])
      ]);

      setGroups(groupsRes);
      setStudySummary(studyRes);
      setSystemCategories(categoriesRes.filter((c: any) => c.is_active).map((c: any) => c.name));
      setSystemLocations(locationsRes.filter((l: any) => l.is_active).map((l: any) => l.name));

      loadLeadersList(filterMinistry);
      loadMembersForEnrollment(filterMinistry);
    } catch (err) {
      console.error("Failed to load Bible study data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMembersForEnrollment = async (ministryId?: number | string) => {
    try {
      const res = await api.getMembers({
        ministry_id: ministryId && ministryId !== "all" ? Number(ministryId) : undefined
      });
      const members = res.map((m: any) => ({
        id: m.id,
        name: `${m.first_name} ${m.last_name}`,
        ministry_name: m.ministry_name,
        age: m.birthdate ? Math.floor((new Date().getTime() - new Date(m.birthdate).getTime()) / 31557600000) : undefined
      })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setMembersList(members);
    } catch (err) {
      console.warn("Could not load members for enrollment", err);
      setMembersList([]);
    }
  };

  const loadLeadersList = async (ministryId?: number | string) => {
    try {
      const [usersRes, membersRes] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getMembers({
          ministry_id: ministryId && ministryId !== "all" ? Number(ministryId) : undefined
        }).catch(() => [])
      ]);

      const userLeaders = (usersRes || []).map((u: any) => ({
        id: u.id,
        name: u.name || `${u.member_first_name || ""} ${u.member_last_name || ""}`.trim() || u.username,
        contact: u.contact_phone || u.email || u.contact_email || "",
        role_name: u.role_name || "User"
      }));

      const memberLeaders = (membersRes || []).map((m: any) => ({
        id: `m-${m.id}`,
        name: `${m.first_name} ${m.last_name}`.trim(),
        contact: m.contact_phone || m.contact_email || "",
        role_name: m.ministry_name ? `${m.ministry_name} Member` : "Church Member"
      }));

      const combined = [...userLeaders, ...memberLeaders];
      const unique = combined.filter((l: any, idx: number, arr: any[]) =>
        l.name && arr.findIndex((x: any) => x.name.toLowerCase().trim() === l.name.toLowerCase().trim()) === idx
      ).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setLeadersList(unique);
    } catch (err) {
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

  const filteredMembers = useMemo(() => {
    const q = memberQuery.toLowerCase().trim();
    const list = !q
      ? membersList
      : membersList.filter(m =>
          m.name.toLowerCase().includes(q) ||
          (m.ministry_name && m.ministry_name.toLowerCase().includes(q))
        );
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [membersList, memberQuery]);

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
      default:
        return { label: "In Progress", bg: "bg-indigo-100 text-indigo-900 border-indigo-300", dot: "bg-indigo-600" };
    }
  };

  const completedCount = useMemo(() => {
    return groups.filter(g => g.progress_stage === "completed").length;
  }, [groups]);

  const completionRate = useMemo(() => {
    if (groups.length === 0) return 0;
    return Math.round((completedCount / groups.length) * 100);
  }, [groups, completedCount]);

  const handleOpenProgressModal = (group: BibleStudyGroup) => {
    setProgressGroupModal(group);
    setProgressFormData({
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
        current_chapter: progressFormData.current_chapter,
        progress_stage: progressFormData.progress_stage,
        progress_notes: progressFormData.progress_notes
      });

      setGroups(prev =>
        prev.map(g =>
          g.id === progressGroupModal.id
            ? {
              ...g,
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
          current_chapter: progressFormData.current_chapter,
          progress_stage: progressFormData.progress_stage,
          progress_notes: progressFormData.progress_notes
        });
      }

      setIsJoinSuccess(`✓ Chapter progress updated for ${progressGroupModal.name}!`);
      setProgressGroupModal(null);
    } catch (err: any) {
      showAlert("Progress Update Failed", err.message || "Failed to update study chapter", "danger");
    } finally {
      setIsSavingProgress(false);
    }
  };

  const handleOpenRescheduleModal = (group: BibleStudyGroup) => {
    setRescheduleGroupModal(group);
  };

  const handleOpenCreateModal = () => {
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
      g.id !== editingGroupId
    );
    if (dupGroup) {
      showAlert("Duplicate Group Name", `A Bible study group named "${formData.name.trim()}" already exists.`, "warning");
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

    try {
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        curriculum: formData.curriculum.trim(),
        ministry_id: formData.ministry_id ? Number(formData.ministry_id) : null,
        leader_name: formData.leader_name.trim(),
        leader_contact: formData.leader_contact.trim(),
        meeting_day: formData.meeting_day,
        meeting_time: formData.meeting_time_end
          ? `${formData.meeting_time_start} - ${formData.meeting_time_end}`
          : formData.meeting_time_start,
        location: formData.location.trim(),
        category: formData.category,
        max_capacity: Number(formData.max_capacity) || 12,
        current_chapter: formData.current_chapter.trim() || "Chapter 1",
        progress_stage: formData.progress_stage || "in_progress",
        progress_notes: formData.progress_notes.trim(),
        member_ids: selectedMemberIds
      };

      if (editingGroupId) {
        await api.updateGroup(editingGroupId, payload);
        setIsJoinSuccess(`✓ Small Group "${formData.name.trim()}" updated successfully!`);
      } else {
        await api.createGroup(payload);
        setIsJoinSuccess(`✓ New Small Group "${formData.name.trim()}" created successfully!`);
      }

      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      showAlert("Save Group Failed", err.message || "Failed to save Bible study group", "danger");
    }
  };

  const handleToggleMember = (memId: number) => {
    setSelectedMemberIds(prev =>
      prev.includes(memId) ? prev.filter(id => id !== memId) : [...prev, memId]
    );
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
    return groups.filter(g => {
      if (filterMinistry && String(g.ministry_id) !== filterMinistry) return false;
      if (selectedCategory !== "all" && g.category !== selectedCategory) return false;
      if (filterDay !== "all" && filterDay !== "All Days" && g.meeting_day !== filterDay) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        g.name.toLowerCase().includes(q) ||
        g.leader_name.toLowerCase().includes(q) ||
        (g.curriculum && g.curriculum.toLowerCase().includes(q)) ||
        (g.location && g.location.toLowerCase().includes(q)) ||
        (g.description && g.description.toLowerCase().includes(q))
      );
    });
  }, [groups, filterMinistry, selectedCategory, filterDay, searchQuery]);

  const totalMembersEnrolled = useMemo(() => {
    return groups.reduce((sum, g) => sum + (g.current_member_count || (g.members ? g.members.length : 0)), 0);
  }, [groups]);

  const canCreate = user?.role_name === "Admin" || user?.role_name === "Coordinator";

  if (loading && groups.length === 0) {
    return <BibleStudyPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {isJoinSuccess && (
        <div className="bg-sage-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between text-xs font-bold animate-bounce-subtle">
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
              <BookOpen className="w-3.5 h-3.5 text-amber-300" />
              <span>Small Groups & Discipleship</span>
            </div>
            <span className="text-xs bg-white/10 border border-white/15 text-slate-200 font-bold px-3 py-1 rounded-full backdrop-blur-md">
              {groups.length} Active Groups
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Bible Study & Discipleship Groups
          </h1>
          <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
            Small group fellowships, Scripture study circles, home meetings, and discipleship tracks.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={() => setIsCompletedModalOpen(true)}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-emerald-300 border border-white/15 font-bold px-4 py-2.5 rounded-2xl text-xs backdrop-blur-md shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Award className="w-4 h-4 text-emerald-300" />
            <span>Completed Groups ({completedCount})</span>
          </button>
          {canCreate && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black px-5 py-2.5 rounded-2xl text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 text-indigo-950" />
              <span>New Bible Study Group</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-indigo-100/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-charcoal/60">Active Small Groups</p>
            <h3 className="text-2xl font-black text-indigo mt-0.5">{groups.length}</h3>
            <p className="text-[10px] text-sage-700 font-bold mt-1">Across all ministries</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo rounded-2xl">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-100/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-charcoal/60">Total Enrolled Members</p>
            <h3 className="text-2xl font-black text-amber-600 mt-0.5">{totalMembersEnrolled}</h3>
            <p className="text-[10px] text-charcoal/50 font-bold mt-1">Discipleship participation</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-100/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-charcoal/60">Average Group Size</p>
            <h3 className="text-2xl font-black text-sage-800 mt-0.5">
              {groups.length > 0 ? Math.round(totalMembersEnrolled / groups.length) : 0} members
            </h3>
            <p className="text-[10px] text-charcoal/50 font-bold mt-1">Target capacity: 10-15</p>
          </div>
          <div className="p-3 bg-sage-50 text-sage-700 rounded-2xl">
            <HeartHandshake className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setIsCompletedModalOpen(true)}
          className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200 shadow-2xs flex items-center justify-between cursor-pointer hover:border-emerald-300 hover:shadow-xs transition-all"
        >
          <div>
            <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
              <span>Completed Studies</span>
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-extrabold">
                {completionRate}%
              </span>
            </p>
            <h3 className="text-2xl font-black text-emerald-900 mt-0.5">
              {completedCount} Groups
            </h3>
            <p className="text-[10px] text-emerald-700 font-bold mt-1 underline">
              View completed archive →
            </p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
            <CheckCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Multi-Level Filter Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-indigo-100/80 shadow-2xs space-y-3.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-gray-100 no-scrollbar">
          <span className="text-xs font-bold text-charcoal/60 mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-amber-600" /> Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === "All" ? "all" : cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${(selectedCategory === "all" && cat === "All") || selectedCategory === cat
                ? "bg-indigo text-white shadow-2xs ring-2 ring-indigo-200"
                : "bg-ivory-light text-charcoal/70 hover:bg-gray-100"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo shrink-0" />
              <select
                value={filterMinistry}
                onChange={(e) => setFilterMinistry(e.target.value)}
                disabled={isRestricted && allowedMinistries.length <= 1}
                className="bg-ivory-light px-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo cursor-pointer disabled:opacity-90 disabled:cursor-not-allowed"
              >
                {!isRestricted && <option value="">🏛️ All Ministries</option>}
                {allowedMinistries.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} Ministry</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="bg-ivory-light px-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo font-semibold text-charcoal cursor-pointer"
              >
                {daysOfWeek.map((day) => (
                  <option key={day} value={day === "All Days" ? "all" : day}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-charcoal/40 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by topic, leader, room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-ivory-light pl-9 pr-3 py-1.5 rounded-xl text-xs border border-gray-200 focus:outline-none focus:border-indigo font-medium"
            />
          </div>
        </div>
      </div>

      {/* Groups Grid */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-indigo-100 text-center space-y-3 shadow-2xs">
          <BookOpen className="w-10 h-10 text-charcoal/30 mx-auto" />
          <h3 className="text-sm font-bold text-charcoal">No Bible Study Groups Found</h3>
          <p className="text-xs text-charcoal/50 max-w-sm mx-auto">
            Try adjusting your category, ministry, or day filters, or schedule a new Bible study group.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGroups.map((g) => {
            const memberCount = g.current_member_count || (g.members ? g.members.length : 0);
            const capacityPercent = Math.min(100, Math.round((memberCount / (g.max_capacity || 12)) * 100));
            const isLeaderOfThis = isUserLeaderOfGroup(g);
            const isDesignatedOfThis = isUserDesignatedInGroup(g);

            return (
              <div
                key={g.id}
                className={`bg-white rounded-3xl p-5 border shadow-xs flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group relative overflow-hidden ${isLeaderOfThis
                  ? "border-amber-300 ring-2 ring-amber-100/70"
                  : isDesignatedOfThis
                    ? "border-sky-300 ring-2 ring-sky-100/70"
                    : "border-indigo-100/80 hover:border-indigo-300"
                  }`}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1.5 opacity-80 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: g.ministry_color || "#2C3968" }}
                />

                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-2.5 pt-1 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="bg-indigo-50/90 text-indigo font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-indigo-100/60">
                        {g.category}
                      </span>
                      {isLeaderOfThis && (
                        <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-slate-950" />
                          <span>Led by You</span>
                        </span>
                      )}
                      {!isLeaderOfThis && isDesignatedOfThis && (
                        <span className="bg-sky-100 text-sky-900 font-black text-[10px] px-2 py-0.5 rounded-full border border-sky-200 flex items-center gap-1">
                          <Users className="w-2.5 h-2.5 text-sky-700" />
                          <span>Your Group</span>
                        </span>
                      )}
                    </div>

                    <span
                      className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white shadow-2xs shrink-0"
                      style={{ backgroundColor: g.ministry_color || "#2C3968" }}
                    >
                      {g.ministry_name || "All-Church"}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-charcoal group-hover:text-indigo transition-colors leading-snug">
                    {g.name}
                  </h3>

                  {g.is_rescheduled && (
                    <div className="mt-3 p-3 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/15 rounded-2xl border border-amber-300/80 text-xs shadow-2xs space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5 font-black text-amber-950 text-xs">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                          </span>
                          <CalendarClock className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Next Session Rescheduled</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRescheduleModal(g);
                          }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/90 hover:bg-amber-300 text-amber-950 border border-amber-400 transition-all cursor-pointer active:scale-95"
                        >
                          Edit Resched
                        </button>
                      </div>
                      <div className="text-[11px] text-amber-950 font-bold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>
                          {g.rescheduled_date ? new Date(g.rescheduled_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : "Date TBD"}
                          {g.rescheduled_time ? ` • ${g.rescheduled_time}` : ""}
                        </span>
                      </div>
                      {g.reschedule_reason && (
                        <div className="text-[10px] text-amber-900/90 bg-white/80 p-2 rounded-xl border border-amber-200/60 leading-tight">
                          <span className="font-bold text-amber-950">Notice: </span>
                          <span>{g.reschedule_reason}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Study Track & Pacing Hub */}
                  <div className="mt-3 p-3.5 bg-gradient-to-br from-indigo-50/70 via-ivory to-amber-50/40 rounded-2xl border border-indigo-100 space-y-2.5">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        <BookOpen className="w-4 h-4 text-amber-700 shrink-0" />
                        <div className="truncate">
                          <span className="font-black text-xs text-charcoal">
                            {g.curriculum || "Scripture Study"}
                          </span>
                          <span className="text-[11px] text-indigo-900 font-bold ml-1.5">
                            • {g.current_chapter || "Chapter 1"}
                          </span>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${getProgressStageBadge(g.progress_stage).bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getProgressStageBadge(g.progress_stage).dot}`}></span>
                        <span>{getProgressStageBadge(g.progress_stage).label}</span>
                      </span>
                    </div>

                    {g.progress_notes && (
                      <div className="bg-white/95 p-2.5 rounded-xl border border-indigo-100/90 text-[11px] text-charcoal/85 flex items-start gap-1.5 shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="leading-tight min-w-0">
                          <span className="font-black text-indigo-950 text-[10px] uppercase tracking-wider block">Current Pacing Notice:</span>
                          <span className="break-words">{g.progress_notes}</span>
                        </div>
                      </div>
                    )}

                    <div className="pt-1.5 flex items-center justify-end gap-1.5 border-t border-indigo-100/60 flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRescheduleModal(g);
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95 ${g.is_rescheduled
                          ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300"
                          : "bg-white hover:bg-amber-50 text-amber-900 border border-amber-200/80"
                          }`}
                      >
                        <CalendarClock className="w-3 h-3 text-amber-700" />
                        <span>{g.is_rescheduled ? "Resched Active ⚠️" : "Reschedule"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProgressModal(g);
                        }}
                        className="text-[10px] font-bold text-indigo-900 hover:text-indigo-950 bg-white hover:bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                      >
                        <BookmarkCheck className="w-3 h-3 text-indigo-600" />
                        <span>Update Chapter</span>
                      </button>
                    </div>
                  </div>

                  {g.description && (
                    <p className="text-xs text-charcoal/70 mt-2.5 line-clamp-2 leading-relaxed">
                      {g.description}
                    </p>
                  )}

                  <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-1.5 text-xs text-charcoal/75 font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-indigo shrink-0" />
                      <div>
                        <span>Meets every <strong>{g.meeting_day}</strong> at {g.meeting_time}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                      <span className="truncate">{g.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-charcoal/60">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Leader: <strong>{g.leader_name}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Bottom Capacity Bar & Primary Actions */}
                <div className="mt-4 pt-3 border-t border-gray-100 space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-charcoal/60 mb-1">
                      <span>Roster: {memberCount} of {g.max_capacity} Enrolled</span>
                      <span>{capacityPercent}% Full</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${capacityPercent >= 80 ? "bg-emerald-500" : capacityPercent >= 40 ? "bg-amber" : "bg-rose"
                          }`}
                        style={{ width: `${capacityPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedGroup(g)}
                      className="flex-1 px-3 py-2 rounded-xl bg-ivory-light hover:bg-gray-200 text-charcoal font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-gray-200/80"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-700" />
                      <span>View Member ({memberCount})</span>
                    </button>
                    {canCreate && (
                      <button
                        onClick={() => handleOpenEditModal(g)}
                        className="flex-1 bg-indigo hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-amber-300" />
                        <span>Edit Group</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GROUP DETAILS & ROSTER MODAL */}
      {selectedGroup && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-indigo-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-indigo-50 text-indigo text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    {selectedGroup.category}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: selectedGroup.ministry_color || "#2C3968" }}
                  >
                    {selectedGroup.ministry_name || "All-Church"}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-charcoal">{selectedGroup.name}</h2>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="p-1 rounded-xl text-charcoal/50 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-ivory rounded-xl border border-amber/20 space-y-2">
                <div className="flex items-center gap-2 text-charcoal font-bold">
                  <BookOpen className="w-4 h-4 text-amber-700" />
                  <span>Curriculum: {selectedGroup.curriculum || "General Scripture Discussion"}</span>
                </div>

                <div className="p-2.5 bg-white/90 rounded-lg border border-indigo-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <BookmarkCheck className="w-4 h-4 text-indigo-700" />
                    <div>
                      <span className="font-bold text-indigo-950 block text-xs">
                        {selectedGroup.current_chapter || "Chapter 1"}
                      </span>
                      {selectedGroup.progress_notes && (
                        <span className="text-[11px] text-charcoal/70 block mt-0.5">
                          Notice: {selectedGroup.progress_notes}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${getProgressStageBadge(selectedGroup.progress_stage).bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getProgressStageBadge(selectedGroup.progress_stage).dot}`}></span>
                      <span>{getProgressStageBadge(selectedGroup.progress_stage).label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenProgressModal(selectedGroup)}
                      className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-[10px] cursor-pointer"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-charcoal/80">
                  <Clock className="w-4 h-4 text-indigo" />
                  <span>Meets every <strong>{selectedGroup.meeting_day}</strong> at {selectedGroup.meeting_time}</span>
                </div>
                <div className="flex items-center gap-2 text-charcoal/80">
                  <MapPin className="w-4 h-4 text-sage-600" />
                  <span>Location: {selectedGroup.location}</span>
                </div>
                <div className="flex items-center gap-2 text-charcoal/80">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Facilitator / Leader: <strong>{selectedGroup.leader_name}</strong> ({selectedGroup.leader_contact || "Contact through Church Office"})</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-charcoal/70 mb-1">Group Vision & Overview:</h4>
                <p className="text-charcoal/80 leading-relaxed bg-ivory-light p-3 rounded-xl border border-gray-100">
                  {selectedGroup.description || "A welcoming small group for spiritual growth, fellowship, and mutual prayer support."}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-charcoal/70 mb-2 flex items-center justify-between">
                  <span>Enrolled Members ({selectedGroup.members?.length || 0} / {selectedGroup.max_capacity})</span>
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedGroup.members && selectedGroup.members.length > 0 ? (
                    [...selectedGroup.members]
                      .sort((a, b) => {
                        const nameA = (a.display_name || a.member_name || `${a.first_name || ""} ${a.last_name || ""}`).trim().toLowerCase();
                        const nameB = (b.display_name || b.member_name || `${b.first_name || ""} ${b.last_name || ""}`).trim().toLowerCase();
                        return nameA.localeCompare(nameB);
                      })
                      .map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-ivory-light border border-gray-100 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo font-bold flex items-center justify-center text-[10px]">
                            {m.display_name ? m.display_name[0] : (m.member_name ? m.member_name[0] : "M")}
                          </div>
                          <span className="font-bold text-charcoal">{m.display_name || m.member_name || `${m.first_name || ""} ${m.last_name || ""}`.trim()}</span>
                        </div>
                        <span className="text-[10px] text-charcoal/50">Joined {new Date(m.joined_at).toLocaleDateString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-charcoal/40 text-center py-3 italic">No members enrolled yet. Be the first to join!</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
              <button
                onClick={() => setSelectedGroup(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-xs text-charcoal hover:bg-gray-200 cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const g = selectedGroup;
                    setSelectedGroup(null);
                    handleOpenRescheduleModal(g);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs border border-amber-300 shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <CalendarClock className="w-4 h-4 text-amber-700" />
                  <span>Reschedule Next Session</span>
                </button>
                {canCreate && (
                  <button
                    onClick={() => handleOpenEditModal(selectedGroup)}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold text-xs shadow-md active:scale-95 transition-transform cursor-pointer"
                  >
                    <Edit className="w-4 h-4 text-amber-300" />
                    <span>Edit Bible Study Group</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CREATE GROUP MODAL */}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl md:max-w-2xl lg:max-w-3xl w-full p-6 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto border border-indigo-100">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-charcoal flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo" />
                <span>{editingGroupId ? "Edit Bible Study Group" : "Create New Bible Study Small Group"}</span>
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 text-charcoal/50 hover:bg-gray-100 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Young Professionals Book of Romans"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo"
                  >
                    {categories.filter(c => c !== "All").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">Ministry Scope</label>
                  <select
                    value={formData.ministry_id}
                    onChange={(e) => {
                      const minId = e.target.value;
                      setFormData({ ...formData, ministry_id: minId });
                      loadLeadersList(minId);
                      loadMembersForEnrollment(minId);
                    }}
                    disabled={isRestricted && allowedMinistries.length <= 1}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-indigo disabled:opacity-90 disabled:cursor-not-allowed"
                  >
                    {!isRestricted && <option value="">🏛️ All-Church</option>}
                    {allowedMinistries.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} Ministry</option>
                    ))}
                  </select>
                </div>
              </div>

              <div ref={curriculumRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-charcoal/70">Book / Study Topic</label>
                  {formData.curriculum && (
                    <span className="text-[10px] text-indigo-600 font-semibold">Select or type custom</span>
                  )}
                </div>
                <div className="relative">
                  <input
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
                    className="w-full bg-ivory-light p-2.5 pr-14 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
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
                      className="absolute right-7 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-rose-500 p-1 cursor-pointer transition-colors"
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-indigo p-0.5 cursor-pointer"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCurriculumDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {isCurriculumDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100">
                    <div className="p-2 bg-indigo-50/70 text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                      <span>Available Books & Topics ({filteredCurricula.length})</span>
                      <span className="text-[9px] text-indigo-600 font-normal">Click to choose</span>
                    </div>
                    {filteredCurricula.length === 0 ? (
                      <div className="p-3 text-center text-charcoal/50 text-[11px]">
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
                            <div className="font-bold text-charcoal group-hover:text-indigo text-xs flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate">{item.title}</span>
                            </div>
                            <div className="text-[10px] text-charcoal/60 pl-5 flex items-center gap-1.5 mt-0.5">
                              <span className={`px-1.5 py-0.2 rounded font-semibold text-[9px] ${item.type === "curriculum" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}>
                                {item.category}
                              </span>
                              {item.total_chapters ? (
                                <span className="truncate text-charcoal/50">• {item.total_chapters} chapters</span>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div ref={leaderRef} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-charcoal/70">Leader / Facilitator *</label>
                  </div>
                  <div className="relative">
                    <input
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
                        setLeaderQuery(e.target.value);
                        setIsLeaderDropdownOpen(true);
                      }}
                      className="w-full bg-ivory-light p-2.5 pr-14 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold"
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-indigo p-0.5 cursor-pointer"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isLeaderDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {isLeaderDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 max-h-56 overflow-y-auto divide-y divide-gray-100">
                      <div className="p-2 bg-indigo-50/70 text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
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
                            setLeaderQuery("");
                            setIsLeaderDropdownOpen(false);
                          }}
                          className="w-full text-left p-2.5 hover:bg-indigo-50/60 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-bold text-charcoal group-hover:text-indigo text-xs">
                              {l.name}
                            </div>
                            <div className="text-[10px] text-charcoal/60 mt-0.5 flex items-center gap-1.5">
                              <span className="bg-gray-100 px-1.5 py-0.2 rounded text-[9px] font-semibold text-charcoal/80">
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
                  <label className="block font-bold text-charcoal/70 mb-1">Leader Contact (Phone / Email)</label>
                  <input
                    type="text"
                    placeholder="e.g. 0917-123-4567 or email"
                    value={formData.leader_contact}
                    onChange={(e) => setFormData({ ...formData, leader_contact: e.target.value })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">Meeting Day *</label>
                  <select
                    value={formData.meeting_day}
                    onChange={(e) => setFormData({ ...formData, meeting_day: e.target.value })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold"
                  >
                    {daysOfWeek.filter(d => d !== "All Days").map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">Start Time *</label>
                  <TimePickerInput
                    value={formData.meeting_time_start}
                    onChange={(val) => setFormData({ ...formData, meeting_time_start: val })}
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1">End Time</label>
                  <TimePickerInput
                    value={formData.meeting_time_end}
                    onChange={(val) => setFormData({ ...formData, meeting_time_end: val })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-charcoal/70 text-xs">Location / Room *</label>
                    <span className="text-[10px] text-indigo font-semibold">Database Rooms</span>
                  </div>
                  <select
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
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-charcoal text-xs cursor-pointer"
                  >
                    <option value="">-- Choose Church Room / Location --</option>
                    {systemLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                    {formData.location && !systemLocations.includes(formData.location) && (
                      <option value={formData.location}>
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
                      className="w-full mt-2 bg-white p-2.5 rounded-xl border border-indigo-300 focus:outline-none focus:border-indigo font-bold text-charcoal text-xs animate-in fade-in"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1 text-xs">Max Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.max_capacity}
                    onChange={(e) => setFormData({ ...formData, max_capacity: Number(e.target.value) || 12 })}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-bold text-xs"
                  />
                </div>
              </div>

              {/* Enrollment section */}
              <div ref={memberRef} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-charcoal/70 text-xs">
                    Enroll Church Members ({selectedMemberIds.length} Selected)
                  </label>
                  {selectedMemberIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedMemberIds([])}
                      className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search church members to add..."
                    value={memberQuery}
                    onChange={(e) => {
                      setMemberQuery(e.target.value);
                      setIsMemberDropdownOpen(true);
                    }}
                    onFocus={() => setIsMemberDropdownOpen(true)}
                    className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-indigo"
                  />
                </div>

                {isMemberDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-indigo-100 max-h-52 overflow-y-auto divide-y divide-gray-100 animate-in fade-in">
                    {filteredMembers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-charcoal/50">
                        No church members found matching "{memberQuery}"
                      </div>
                    ) : (
                      filteredMembers.map((mem) => {
                        const isSelected = selectedMemberIds.includes(mem.id);
                        return (
                          <div
                            key={mem.id}
                            onClick={() => handleToggleMember(mem.id)}
                            className={`p-2 hover:bg-indigo-50 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? "bg-indigo-50/80 font-bold" : ""}`}
                          >
                            <div>
                              <div className="text-xs text-charcoal">{mem.name}</div>
                              {mem.ministry_name && <div className="text-[10px] text-charcoal/50">{mem.ministry_name}</div>}
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isSelected ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-gray-100 text-charcoal/60"}`}>
                              {isSelected ? "✓ Added" : "+ Add"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Display list of all currently enrolled/selected members */}
                {enrolledMembersDetails.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="text-[11px] font-bold text-charcoal/60">
                      Currently Enrolled Disciples ({enrolledMembersDetails.length}):
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-2.5 bg-indigo-50/50 rounded-2xl border border-indigo-100/80 max-h-36 overflow-y-auto">
                      {enrolledMembersDetails.map((mem) => (
                        <span
                          key={mem.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-indigo-200 text-charcoal text-xs font-bold shadow-2xs hover:border-rose-300 transition-all"
                        >
                          <span>{mem.name}</span>
                          {mem.ministry_name && (
                            <span className="text-[10px] text-indigo-700/70 font-normal">({mem.ministry_name})</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleMember(mem.id)}
                            className="w-4 h-4 rounded-full hover:bg-rose-100 text-charcoal/40 hover:text-rose-600 flex items-center justify-center cursor-pointer ml-0.5"
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
                <label className="block font-bold text-charcoal/70 mb-1">Description / Group Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Group focus, target audience, study style..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-bold shadow-md cursor-pointer"
                >
                  {editingGroupId ? "Save Changes" : "Create Small Group"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* QUICK UPDATE PROGRESS MODAL */}
      {progressGroupModal && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-100 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <BookmarkCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-charcoal">Update Study Chapter</h3>
                  <p className="text-xs text-charcoal/60 truncate max-w-xs">{progressGroupModal.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProgressGroupModal(null)}
                className="p-1.5 text-charcoal/40 hover:text-charcoal hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProgress} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Current Chapter / Lesson *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 1"
                  value={progressFormData.current_chapter}
                  onChange={(e) => setProgressFormData({ ...progressFormData, current_chapter: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1">Notice & Pacing Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe where the group is currently discussing..."
                  value={progressFormData.progress_notes}
                  onChange={(e) => setProgressFormData({ ...progressFormData, progress_notes: e.target.value })}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200"
                />
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setProgressGroupModal(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-semibold text-charcoal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProgress}
                  className="px-5 py-2 rounded-xl bg-indigo text-white font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingProgress ? "Saving..." : "Save Chapter Progress"}
                </button>
              </div>
            </form>
          </div>
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
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-emerald-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                  <Award className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-charcoal">Completed Bible Study Groups</h3>
                  <p className="text-xs text-charcoal/60">{completedCount} groups finished curriculum tracks</p>
                </div>
              </div>
              <button onClick={() => setIsCompletedModalOpen(false)} className="p-1.5 text-charcoal/40 hover:bg-gray-100 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {groups.filter(g => g.progress_stage === "completed").length === 0 ? (
                <p className="text-xs text-charcoal/50 text-center py-6">No completed groups yet in this cycle.</p>
              ) : (
                groups.filter(g => g.progress_stage === "completed").map(g => (
                  <div key={g.id} className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-emerald-950">{g.name}</div>
                      <div className="text-[10px] text-emerald-800">{g.curriculum} • Leader: {g.leader_name}</div>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                      ✓ Completed
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

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

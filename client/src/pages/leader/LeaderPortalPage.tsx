import { ModalPanel } from "../../components/common/ModalPanel";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api";
import { useGuideDataState } from "../../components/help/GuideDataContext";
import { useSocketEvent } from "../../socket";
import {
  BibleStudyGroup, Member, Announcement, StudyTopic,
  BibleStudyMember, SundayDutyScheduleItem
} from "../../types";
import {
  BookOpen, Users, RefreshCw, X, Check, UserPlus, Send,
  CheckCircle2, AlertCircle, Plus, ShieldCheck, Heart,
  ChevronDown, ChevronRight, BookmarkCheck, ClipboardCheck,
  ArrowLeftRight, CalendarClock, Clock, Utensils, Search, Filter, Mail, Phone
} from "lucide-react";

import { LeaderDashboard } from "./LeaderDashboard";
import { LeaderMembers } from "./LeaderMembers";
import { LeaderBibleStudy } from "./LeaderBibleStudy";
import { LeaderAttendanceMonitor } from "./LeaderAttendanceMonitor";
import { DashboardSkeleton } from "../../components/common/SkeletonLoader";
import { NavTab } from "../../components/layout/Sidebar";
import { BibleStudyRescheduleModal } from "../../components/biblestudy/BibleStudyRescheduleModal";
import {
  SessionDatePicker,
  SessionDatePickerCompactRow,
  SessionFlyoutPanel,
  SessionOptionItem
} from "../../components/biblestudy/SessionDatePicker";
import { getSessionDates } from "../../utils/sessionDateHelper";
import { getScheduleDates, isDateMatchingSchedule } from "../../utils/scheduleHelper";

interface LeaderPortalPageProps {
  initialTab?: "dashboard" | "members" | "biblestudy" | "attendance_monitor" | "duty";
  onTabChange?: (tab: "dashboard" | "members" | "biblestudy" | "attendance_monitor" | "duty") => void;
  onNavigateGeneralTab?: (tab: NavTab) => void;
}

export const LeaderPortalPage: React.FC<LeaderPortalPageProps> = ({
  initialTab = "dashboard",
  onTabChange,
  onNavigateGeneralTab
}) => {
  const { user, selectedMinistryId } = useAuth();
  const isLeaderOrHigher = user?.role_name === "Leader" || user?.role_name === "Coordinator" || user?.role_name === "Pastor" || user?.role_name === "Admin" || user?.role_name === "IT Admin";

  // Active sub-view: "dashboard" | "biblestudy" | "attendance_monitor" | "duty"
  const [activeTab, setActiveTab] = useState<"dashboard" | "members" | "biblestudy" | "attendance_monitor" | "duty">(
    !isLeaderOrHigher ? "dashboard" : (initialTab as any)
  );

  useEffect(() => {
    if (!isLeaderOrHigher) {
      setActiveTab("dashboard");
    } else if (initialTab) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab, isLeaderOrHigher]);

  const handleSelectTab = (tab: "dashboard" | "members" | "biblestudy" | "attendance_monitor" | "duty") => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // State
  const [myGroups, setMyGroups] = useState<BibleStudyGroup[]>([]);
  const [groupsUserId, setGroupsUserId] = useState<number | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [studyTopics, setStudyTopics] = useState<StudyTopic[]>([]);
  const [designatedDishwashing, setDesignatedDishwashing] = useState<SundayDutyScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRequest = useRef(0);
  useEffect(() => () => { loadRequest.current++; }, []);

  // Group selection IDs
  const [selectedLedGroupId, setSelectedLedGroupId] = useState<number | null>(null);
  const [isGroupSwitcherOpen, setIsGroupSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [isAddDiscipleModalOpen, setIsAddDiscipleModalOpen] = useState(false);
  const [selectedMemberIdsToAdd, setSelectedMemberIdsToAdd] = useState<number[]>([]);
  const [addDiscipleSearchQuery, setAddDiscipleSearchQuery] = useState<string>("");
  const [addDiscipleMinistryFilter, setAddDiscipleMinistryFilter] = useState<string>("all");

  // Roll-Call Session Attendance State
  const [isRollCallModalOpen, setIsRollCallModalOpen] = useState(false);
  const [rollCallDate, setRollCallDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [rollCallAttendees, setRollCallAttendees] = useState<Record<number, boolean>>({});
  const [rollCallNotes, setRollCallNotes] = useState<string>("");
  const [rollCallBook, setRollCallBook] = useState("");
  const [rollCallChapter, setRollCallChapter] = useState("");
  const [updateGroupProgress, setUpdateGroupProgress] = useState(false);
  const [latestLoggedSessionDate, setLatestLoggedSessionDate] = useState("");
  const initialRollCallLesson = useRef({ book: "", chapter: "", update: false });
  const [isSavingRollCall, setIsSavingRollCall] = useState(false);
  const [rollCallSessionsList, setRollCallSessionsList] = useState<SessionOptionItem[]>([]);
  const [isSpecialRollCall, setIsSpecialRollCall] = useState(false);
  const [specialRollCallReason, setSpecialRollCallReason] = useState("");
  const [isRollCallFlyoutOpen, setIsRollCallFlyoutOpen] = useState(false);
  const [rollCallWeeksBack, setRollCallWeeksBack] = useState(8);
  const rollCallChangeButtonRef = useRef<HTMLButtonElement | null>(null);
  const initialRollCallData = useRef<{ attendees: Record<number, boolean>; notes: string; date: string }>({
    attendees: {},
    notes: "",
    date: ""
  });

  // Bulletin Announcement State
  const [isBulletinModalOpen, setIsBulletinModalOpen] = useState(false);
  const [bulletinSubject, setBulletinSubject] = useState("");
  const [bulletinMessage, setBulletinMessage] = useState("");
  const [isSendingBulletin, setIsSendingBulletin] = useState(false);

  // Shift Swap Modal State
  const [isSwapShiftModalOpen, setIsSwapShiftModalOpen] = useState(false);

  // Reschedule Room & Day Inspector Modal State
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setIsGroupSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global Escape key listener: closes flyout if open, closes modal if flyout closed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isRollCallFlyoutOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsRollCallFlyoutOpen(false);
          rollCallChangeButtonRef.current?.focus();
        } else if (isRollCallModalOpen) {
          e.preventDefault();
          setIsRollCallModalOpen(false);
        }
      }
    };
    if (isRollCallModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRollCallModalOpen, isRollCallFlyoutOpen]);

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
    const requestId = ++loadRequest.current;
    try {
      setLoading(true);
      setLoadError(null);
      const [grps, mems, anns, topics, dishRes] = await Promise.all([
        api.getMyGroups(),
        api.getMembers({ ministry_id: selectedMinistryId ?? undefined }).catch(() => []),
        api.getAnnouncements(selectedMinistryId ?? undefined).catch(() => []),
        api.getStudyTopics({ ministry_id: selectedMinistryId ?? undefined }).catch(() => null),
        api.getDishwashingSchedule({ count: 12 }).catch(() => ({ schedule: [] }))
      ]);

      if (requestId !== loadRequest.current) return;
      const rawGroups: BibleStudyGroup[] = grps || [];
      setMyGroups(rawGroups);
      setGroupsUserId(user?.id ?? null);
      setAllMembers(mems || []);
      setAnnouncements(anns || []);
      setStudyTopics(topics?.all || []);

      const userGroupIds = new Set(rawGroups.map(group => group.id));
      const myDishwashing = (dishRes?.schedule || []).filter((d: SundayDutyScheduleItem) => {
        if (!d.team) return false;
        return d.team.biblestudy_group_ids?.some(id => userGroupIds.has(id))
          || (d.team.biblestudy_group_id != null && userGroupIds.has(d.team.biblestudy_group_id));
      });
      setDesignatedDishwashing(myDishwashing);

    } catch (err: any) {
      if (requestId !== loadRequest.current) return;
      setMyGroups([]);
      setDesignatedDishwashing([]);
      setLoadError("Unable to load your assigned groups. Please try again.");
    } finally {
      if (requestId === loadRequest.current) setLoading(false);
    }
  };

  // The personal endpoint is already scoped to this account, for every role.
  useEffect(() => {
    setSelectedLedGroupId(current => myGroups.some(group => group.id === current)
      ? current : myGroups[0]?.id ?? null);
    setIsGroupSwitcherOpen(false);
  }, [myGroups]);

  const activeGroup = useMemo(() =>
    groupsUserId === user?.id ? myGroups.find(group => group.id === selectedLedGroupId) ?? myGroups[0] ?? null : null,
    [myGroups, selectedLedGroupId, groupsUserId, user?.id]);

  useEffect(() => {
    setIsRollCallModalOpen(false);
    setIsAddDiscipleModalOpen(false);
    setIsBulletinModalOpen(false);
    setIsSwapShiftModalOpen(false);
    setIsRescheduleModalOpen(false);
    setSelectedMemberIdsToAdd([]);
  }, [activeGroup?.id]);

  const activeGroupDuties = useMemo(() => designatedDishwashing.filter(duty =>
    activeGroup && (duty.team?.biblestudy_group_id === activeGroup.id
      || duty.team?.biblestudy_group_ids?.includes(activeGroup.id))), [designatedDishwashing, activeGroup]);

  const currentMembers: BibleStudyMember[] = useMemo(() => {
    if (!activeGroup || !activeGroup.members) return [];
    return activeGroup.members;
  }, [activeGroup]);

  const availableMinistries = useMemo(() => {
    const list = Array.from(new Set(allMembers.map(m => m.ministry_name).filter(Boolean))) as string[];
    return list.sort();
  }, [allMembers]);

  const availableMembersToAdd = useMemo(() => {
    const existingIds = new Set((activeGroup?.members || []).map(d => d.member_id || (d as any).id).filter(Boolean));
    return allMembers.filter(m => !existingIds.has(m.id));
  }, [allMembers, activeGroup]);

  const filteredAvailableMembersToAdd = useMemo(() => {
    return availableMembersToAdd.filter(m => {
      // Ministry filter
      if (addDiscipleMinistryFilter !== "all") {
        if (addDiscipleMinistryFilter === "none") {
          if (m.ministry_name) return false;
        } else if (m.ministry_name !== addDiscipleMinistryFilter) {
          return false;
        }
      }

      // Search keyword
      if (addDiscipleSearchQuery.trim()) {
        const q = addDiscipleSearchQuery.toLowerCase().trim();
        const fullName = `${m.first_name || ""} ${m.last_name || ""}`.toLowerCase();
        const email = (m.contact_email || "").toLowerCase();
        const phone = (m.contact_phone || "").toLowerCase();
        const ministry = (m.ministry_name || "").toLowerCase();
        return fullName.includes(q) || email.includes(q) || phone.includes(q) || ministry.includes(q);
      }

      return true;
    });
  }, [availableMembersToAdd, addDiscipleMinistryFilter, addDiscipleSearchQuery]);

  const isRollCallDirty = () => {
    const lesson = initialRollCallLesson.current;
    if (rollCallBook !== lesson.book || rollCallChapter !== lesson.chapter || updateGroupProgress !== lesson.update) return true;
    const initialAtt = initialRollCallData.current.attendees;
    const keys = Object.keys(rollCallAttendees);
    for (const k of keys) {
      if (Boolean(rollCallAttendees[Number(k)]) !== Boolean(initialAtt[Number(k)])) {
        return true;
      }
    }
    if (rollCallNotes.trim() !== (initialRollCallData.current.notes || "").trim()) {
      return true;
    }
    return false;
  };

  const handleBeforeChangeSession = async (targetSession: SessionOptionItem) => {
    if (targetSession.date === rollCallDate) return true;
    if (isRollCallDirty()) {
      const confirmed = window.confirm(
        "You have unsaved roll-call changes for this session. Discard changes and switch session?"
      );
      return confirmed;
    }
    return true;
  };

  const handleLoadOlderRollCallSessions = async () => {
    if (!activeGroup) return;
    const newWeeks = rollCallWeeksBack + 8;
    setRollCallWeeksBack(newWeeks);

    const baseSessions = getSessionDates(activeGroup.meeting_day, activeGroup.meeting_time, newWeeks);

    let existingSessions: any[] = [];
    try {
      const attRes = await api.getGroupAttendance(activeGroup.id);
      if (attRes?.sessions) {
        existingSessions = attRes.sessions;
      }
    } catch (e) {
      console.warn("Error fetching attendance for older sessions:", e);
    }

    const sessionsWithStatus: SessionOptionItem[] = baseSessions.map((b) => {
      const matched = existingSessions.find((s: any) => s.session_date === b.date);
      return {
        ...b,
        isLogged: Boolean(matched),
        loggedSession: matched || undefined,
      };
    });

    setRollCallSessionsList(sessionsWithStatus);
  };

  const canUpdateRollCallProgress = (date: string, sessions: SessionOptionItem[]) =>
    activeGroup?.status === "active" && date >= latestLoggedSessionDate && !sessions.some(s => s.isLogged && s.date > date);

  const initializeRollCallLesson = (date: string, session: SessionOptionItem | undefined, sessions: SessionOptionItem[]) => {
    const book = session?.loggedSession?.topic_title || activeGroup?.curriculum || "Weekly Bible Study";
    const chapter = session?.loggedSession?.chapter || activeGroup?.current_chapter || "Chapter 1";
    const update = Boolean(activeGroup?.status === "active" && !sessions.some(s => s.isLogged && s.date > date) && date >= latestLoggedSessionDate);
    setRollCallBook(book);
    setRollCallChapter(chapter);
    setUpdateGroupProgress(update);
    initialRollCallLesson.current = { book, chapter, update };
  };

  const handleOpenRollCall = async () => {
    if (!activeGroup) return;

    setRollCallWeeksBack(16);
    setIsRollCallFlyoutOpen(false);

    // 1. Generate base 16 sessions according to group's schedule (~4 months)
    const baseSessions = getSessionDates(activeGroup.meeting_day, activeGroup.meeting_time, 16);

    // 2. Fetch existing group attendance sessions to determine Logged vs Missing
    let existingSessions: any[] = [];
    try {
      const attRes = await api.getGroupAttendance(activeGroup.id);
      if (attRes?.sessions) {
        existingSessions = attRes.sessions;
      }
    } catch (e) {
      console.warn("Note fetching existing attendance for roll call:", e);
    }

    const sessionsWithStatus: SessionOptionItem[] = baseSessions.map((b) => {
      const matched = existingSessions.find((s: any) => s.session_date === b.date);
      return {
        ...b,
        isLogged: Boolean(matched),
        loggedSession: matched || undefined,
      };
    });

    setRollCallSessionsList(sessionsWithStatus);
    setIsSpecialRollCall(false);
    setSpecialRollCallReason("");

    // 3. Default selection = latest session that has NO attendance yet; if none missing, default to latest
    const firstMissing = sessionsWithStatus.find(s => !s.isLogged);
    const targetSession = firstMissing || sessionsWithStatus[0];
    const latestLogged = existingSessions.reduce((latest, session) => session.session_date > latest ? session.session_date : latest, "");
    setLatestLoggedSessionDate(latestLogged);
    initializeRollCallLesson(targetSession?.date || new Date().toISOString().split("T")[0], targetSession, sessionsWithStatus);
    const defaultUpdate = Boolean(activeGroup.status === "active" && targetSession && targetSession.date >= latestLogged);
    setUpdateGroupProgress(defaultUpdate);
    initialRollCallLesson.current.update = defaultUpdate;

    if (targetSession) {
      setRollCallDate(targetSession.date);

      if (targetSession.isLogged && targetSession.loggedSession) {
        // Pre-fill existing attendees & notes in Edit mode
        const initialAtt: Record<number, boolean> = {};
        (activeGroup.members || []).forEach((m: any) => {
          initialAtt[m.member_id || m.id] = false;
        });
        (targetSession.loggedSession.attendees || []).forEach((a: any) => {
          initialAtt[a.member_id] = true;
        });
        setRollCallAttendees(initialAtt);
        setRollCallNotes(targetSession.loggedSession.notes || "");
        initialRollCallData.current = {
          attendees: { ...initialAtt },
          notes: targetSession.loggedSession.notes || "",
          date: targetSession.date,
        };
      } else {
        const initialAtt: Record<number, boolean> = {};
        (activeGroup.members || []).forEach((m: any) => {
          initialAtt[m.member_id || m.id] = true;
        });
        setRollCallAttendees(initialAtt);
        setRollCallNotes("");
        initialRollCallData.current = {
          attendees: { ...initialAtt },
          notes: "",
          date: targetSession.date,
        };
      }
    } else {
      const today = new Date().toISOString().split("T")[0];
      setRollCallDate(today);
      const initialAtt: Record<number, boolean> = {};
      (activeGroup.members || []).forEach((m: any) => {
        initialAtt[m.member_id || m.id] = true;
      });
      setRollCallAttendees(initialAtt);
      setRollCallNotes("");
      initialRollCallData.current = {
        attendees: { ...initialAtt },
        notes: "",
        date: today,
      };
    }

    setIsRollCallModalOpen(true);
  };

  const handleSessionChange = (date: string, session?: SessionOptionItem) => {
    initializeRollCallLesson(date, session, rollCallSessionsList);
    setRollCallDate(date);
    setIsSpecialRollCall(false);

    if (session?.isLogged && session.loggedSession) {
      const initialAtt: Record<number, boolean> = {};
      (activeGroup?.members || []).forEach((m: any) => {
        initialAtt[m.member_id || m.id] = false;
      });
      (session.loggedSession.attendees || []).forEach((a: any) => {
        initialAtt[a.member_id] = true;
      });
      setRollCallAttendees(initialAtt);
      setRollCallNotes(session.loggedSession.notes || "");
      initialRollCallData.current = {
        attendees: { ...initialAtt },
        notes: session.loggedSession.notes || "",
        date,
      };
    } else {
      const initialAtt: Record<number, boolean> = {};
      (activeGroup?.members || []).forEach((m: any) => {
        initialAtt[m.member_id || m.id] = true;
      });
      setRollCallAttendees(initialAtt);
      setRollCallNotes("");
      initialRollCallData.current = {
        attendees: { ...initialAtt },
        notes: "",
        date,
      };
    }
  };

  const handleSpecialChange = (isSpecial: boolean, date: string, reason: string) => {
    if (date !== rollCallDate) {
      const matched = rollCallSessionsList.find(s => s.date === date);
      initializeRollCallLesson(date, matched, rollCallSessionsList);
    }
    setIsSpecialRollCall(isSpecial);
    setRollCallDate(date);
    setSpecialRollCallReason(reason);
    if (isSpecial) {
      setIsRollCallFlyoutOpen(false);
    }
  };

  const handleSaveRollCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;
    if (isSavingRollCall) return;
    if (!rollCallBook.trim() || !rollCallChapter.trim()) {
      showToast("Enter the book / study topic and chapter covered in this session", "error");
      return;
    }

    if (isSpecialRollCall && !specialRollCallReason.trim()) {
      showToast("Please provide a reason for the special / rescheduled session", "error");
      return;
    }

    try {
      setIsSavingRollCall(true);
      const presentIds = Object.keys(rollCallAttendees)
        .filter(id => rollCallAttendees[Number(id)])
        .map(Number);

      await api.saveGroupAttendance(activeGroup.id, {
        session_date: rollCallDate,
        topic_title: rollCallBook.trim(),
        chapter: rollCallChapter.trim(),
        update_group_progress: updateGroupProgress,
        notes: rollCallNotes.trim() || undefined,
        present_member_ids: presentIds,
        is_special: isSpecialRollCall,
        special_reason: isSpecialRollCall ? specialRollCallReason.trim() : undefined,
      });

      showToast(`Weekly Roll-Call for"${activeGroup.name}" on ${rollCallDate} saved successfully!`, "success");
      setIsRollCallModalOpen(false);
      loadLeaderData();
    } catch (err: any) {
      showToast(err.message || "Failed to save roll call", "error");
    } finally {
      setIsSavingRollCall(false);
    }
  };

  const handleSendBulletin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulletinMessage.trim()) return;
    try {
      setIsSendingBulletin(true);
      showToast(`Group bulletin sent to all active disciples in"${activeGroup?.name}"!`, "success");
      setBulletinSubject("");
      setBulletinMessage("");
      setIsBulletinModalOpen(false);
    } catch (err: any) {
      showToast(err.message || "Failed to broadcast bulletin", "error");
    } finally {
      setIsSendingBulletin(false);
    }
  };

  const handleToggleMemberToAdd = (mId: number) => {
    setSelectedMemberIdsToAdd(prev =>
      prev.includes(mId) ? prev.filter(id => id !== mId) : [...prev, mId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredAvailableMembersToAdd.map(m => m.id);
    setSelectedMemberIdsToAdd(prev => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleClearAllSelected = () => {
    setSelectedMemberIdsToAdd([]);
  };

  const handleRemoveSelectedMember = (mId: number) => {
    setSelectedMemberIdsToAdd(prev => prev.filter(id => id !== mId));
  };

  const handleAddMemberToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || selectedMemberIdsToAdd.length === 0) return;
    try {
      const res = await api.joinGroup(activeGroup.id, { member_ids: selectedMemberIdsToAdd });
      showToast(res.message || `Successfully enrolled ${selectedMemberIdsToAdd.length} disciple(s) to ${activeGroup.name}!`, "success");
      setSelectedMemberIdsToAdd([]);
      setAddDiscipleSearchQuery("");
      setAddDiscipleMinistryFilter("all");
      setIsAddDiscipleModalOpen(false);
      loadLeaderData();
    } catch (err: any) {
      showToast(err.message || "Failed to enroll members", "error");
    }
  };

  useGuideDataState("assigned-groups", { loading, count: myGroups.length, error: loadError, retry: loadLeaderData });

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!activeGroup) {
    return (
      <section data-guide="my-group-empty" className="space-y-5">
        <h1 className="text-2xl sm:text-3xl font-semibold text-charcoal">My Bible Study Group</h1>
        <div className="rounded-3xl border border-indigo-100 bg-white p-8 text-center space-y-3">
          <Users className="w-10 h-10 mx-auto text-indigo" />
          <h2 className="text-lg font-semibold text-charcoal">{loadError ? "Unable to load groups" : "No assigned group"}</h2>
          <p className="text-sm text-charcoal/70">
            {loadError || "You are not currently assigned to a Bible study group. Please contact your church coordinator to be assigned as a leader, assistant leader, or member."}
          </p>
          <button data-guide="my-group-refresh" type="button" onClick={loadLeaderData} className="inline-flex items-center gap-2 rounded-xl bg-indigo px-4 py-2 text-sm font-medium text-white">
            <RefreshCw className="w-4 h-4" /> {loadError ? "Try again" : "Refresh assignments"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between text-xs font-medium animate-in fade-in ${toastMsg.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-amber-300" />
            <span>{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="p-1 hover:text-gray-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Breadcrumb + Status Tag */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted font-medium">
          <span>Bible Study & Discipleship</span>
          <ChevronRight className="w-3.5 h-3.5 text-charcoal/30" />
          <span className="text-indigo font-medium">My Bible Study Group</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
          <span>Facilitator / Leader Active</span>
        </div>
      </div>

      {/* Header & Group Selector Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-charcoal tracking-tight">
            My Bible Study Group
          </h1>
          <p className="text-xs sm:text-sm text-charcoal/70 mt-0.5 max-w-2xl leading-relaxed">
            Discipleship life groups and flock formation, roll call attendance, and coordinated church service rotations.
          </p>
        </div>

        {/* Group Switcher Dropdown */}
        <div ref={switcherRef} className="relative shrink-0">
          <button
            type="button"
            aria-label="Switch my Bible study group"
            data-guide="my-group-switcher"
            aria-expanded={isGroupSwitcherOpen}
            onClick={() => setIsGroupSwitcherOpen(!isGroupSwitcherOpen)}
            className="flex items-center gap-2.5 bg-white border border-indigo-200 hover:border-indigo-400 px-4 py-2.5 rounded-2xl shadow-2xs hover:shadow-md transition-all text-xs font-medium text-charcoal cursor-pointer active:scale-95"
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo flex items-center justify-center font-medium text-xs">
              <Users className="w-3.5 h-3.5 text-indigo-700" />
            </div>
            <div className="text-left">
              <div className="text-xs font-medium text-charcoal truncate max-w-[200px]">
                {activeGroup?.name || "Select Group"}
              </div>
              <div className="text-[12px] text-muted font-medium">
                {activeGroup?.category ? `(${activeGroup.category})` : "Active Life Group"}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isGroupSwitcherOpen ? "rotate-180" : ""}`} />
          </button>

          {isGroupSwitcherOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-indigo-100 p-2 z-50 divide-y divide-gray-100 animate-in fade-in zoom-in-95">
              <div className="p-2 text-[12px] font-medium text-indigo-950 uppercase tracking-wider flex items-center justify-between">
                <span>Switch Small Group ({myGroups.length})</span>
              </div>
              <div className="max-h-60 overflow-y-auto py-1 space-y-1">
                {myGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedLedGroupId(g.id);
                      setIsGroupSwitcherOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${g.id === activeGroup?.id
                      ? "bg-indigo-50 text-indigo font-medium"
                      : "hover:bg-gray-50 text-charcoal"
                      }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate">{g.name}</div>
                      <div className="text-[12px] text-muted">{g.category || "General"} • {g.leader_name}</div>
                    </div>
                    {g.id === activeGroup?.id && <Check className="w-4 h-4 text-indigo shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200/80 pb-3 overflow-x-auto no-scrollbar">
        <button data-guide="my-group-overview"
          onClick={() => handleSelectTab("dashboard")}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer ${activeTab === "dashboard"
            ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-800"
            : "bg-white text-charcoal/70 hover:bg-gray-100 hover:text-charcoal border border-gray-200"
            }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Overview & Life Group</span>
        </button>

        <button
          onClick={() => handleSelectTab("biblestudy")}
          data-guide="my-group-meetings"
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer ${activeTab === "biblestudy"
            ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-800"
            : "bg-white text-charcoal/70 hover:bg-gray-100 hover:text-charcoal border border-gray-200"
            }`}
        >
          <BookmarkCheck className="w-4 h-4" />
          <span>Curriculum & Roll-Call</span>
          <span className="bg-indigo-100 text-indigo-900 text-[12px] font-medium px-2 py-0.2 rounded-full">
            12 Wks
          </span>
        </button>

        <button data-guide="my-group-attendance"
          onClick={() => handleSelectTab("attendance_monitor")}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer ${activeTab === "attendance_monitor"
            ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-800"
            : "bg-white text-charcoal/70 hover:bg-gray-100 hover:text-charcoal border border-gray-200"
            }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Attendance Monitor</span>
          <span className="bg-emerald-100 text-emerald-900 text-[12px] font-medium px-2 py-0.2 rounded-full">
            History & Absences
          </span>
        </button>

        <button data-guide="my-group-duty"
          onClick={() => handleSelectTab("duty")}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium transition-all cursor-pointer ${activeTab === "duty"
            ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-800"
            : "bg-white text-charcoal/70 hover:bg-gray-100 hover:text-charcoal border border-gray-200"
            }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Sunday Dishwashing Roster</span>
          <span className="bg-amber-100 text-amber-900 text-[12px] font-medium px-2 py-0.2 rounded-full">
            My Schedule
          </span>
        </button>
      </div>

      {/* Render Active View */}
      {activeTab === "dashboard" && (
        <LeaderDashboard
          activeGroup={activeGroup}
          groupDisciples={currentMembers}
          studyTopics={studyTopics}
          designatedDishwashing={activeGroupDuties}
          onNavigateTab={setActiveTab}
          onNavigateGeneralTab={onNavigateGeneralTab}
          onOpenRollCall={handleOpenRollCall}
          onOpenBulletin={() => setIsBulletinModalOpen(true)}
          onOpenAddDisciple={() => setIsAddDiscipleModalOpen(true)}
          onOpenSwapShift={() => setIsSwapShiftModalOpen(true)}
          onOpenReschedule={() => setIsRescheduleModalOpen(true)}
        />
      )}

      {activeTab === "members" && (
        <LeaderMembers
          activeGroup={activeGroup}
          groupDisciples={currentMembers}
          ledGroups={myGroups}
          selectedGroupId={selectedLedGroupId}
          onSelectGroup={(id) => setSelectedLedGroupId(id)}
          onOpenAddDiscipleModal={() => setIsAddDiscipleModalOpen(true)}
          onOpenCreateGroupModal={() => { }}
        />
      )}

      {activeTab === "biblestudy" && (
        <LeaderBibleStudy
          activeGroup={activeGroup}
          groupDisciples={currentMembers}
          onSaveAttendanceSession={(date, memberIds) => {
            showToast(`Logged attendance for ${memberIds.length} members on ${date}!`);
            loadLeaderData();
          }}
          onGroupUpdated={loadLeaderData}
        />
      )}

      {activeTab === "attendance_monitor" && (
        <LeaderAttendanceMonitor
          activeGroup={activeGroup}
          onOpenRollCall={handleOpenRollCall}
          onToast={showToast}
        />
      )}

      {activeTab === "duty" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-indigo-100 shadow-2xs space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-xl font-semibold text-charcoal">Sunday Fellowship Meal Dishwashing Roster</h3>
              <p className="text-xs text-muted mt-0.5">
                Sunday fellowship meal dishwashing assignments for your selected group.
              </p>
            </div>
            <button
              onClick={() => setIsSwapShiftModalOpen(true)}
              className="bg-indigo hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-2xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
            >
              <ArrowLeftRight className="w-4 h-4 text-amber-300" />
              <span>Request Shift Swap</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[12px] font-medium text-muted uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3.5 px-4">Rotation Date</th>
                  <th className="py-3.5 px-4">Assigned Group / Ministry</th>
                  <th className="py-3.5 px-4">Service Category</th>
                  <th className="py-3.5 px-4">Operating Checklist</th>
                  <th className="py-3.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeGroupDuties.map(duty => (
                  <tr key={`${duty.duty_date}-${duty.team?.id}`}>
                    <td className="py-3.5 px-4 font-medium">{duty.date_formatted || duty.duty_date}</td>
                    <td className="py-3.5 px-4">{activeGroup.name}</td>
                    <td className="py-3.5 px-4">Sunday Dishwashing</td>
                    <td className="py-3.5 px-4 text-charcoal/70">{duty.team?.tasks_checklist || "Contact your coordinator for details."}</td>
                    <td className="py-3.5 px-4 text-right">{duty.status.replace('_', ' ')}</td>
                  </tr>
                ))}
                {activeGroupDuties.length === 0 && (
                  <tr><td colSpan={5} className="py-6 px-4 text-center text-charcoal/70">No dishwashing assignments for this group.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: TAKE ROLL-CALL ATTENDANCE */}
      {/* ==================================================== */}
      {isRollCallModalOpen && activeGroup && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onClick={() => {
            if (isRollCallFlyoutOpen) {
              setIsRollCallFlyoutOpen(false);
              rollCallChangeButtonRef.current?.focus();
            } else {
              setIsRollCallModalOpen(false);
            }
          }}
        >
          <div
            className={`bg-white rounded-3xl shadow-2xl border border-indigo-100 h-[640px] max-h-[90vh] flex flex-col md:flex-row overflow-hidden transition-all duration-200 ease-out w-full ${
              isRollCallFlyoutOpen && !isSpecialRollCall
                ? "max-w-lg md:max-w-3xl lg:max-w-4xl"
                : "max-w-lg"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const currentSelectedSession = rollCallSessionsList.find(s => s.date === rollCallDate);
              const isEditMode = !isSpecialRollCall && Boolean(currentSelectedSession?.isLogged);

              return (
                <>
                  {/* Left Column: Main Roll-Call Form */}
                  <form
                    onSubmit={handleSaveRollCall}
                    className="flex-1 min-w-0 flex flex-col h-full text-xs"
                  >
                    {/* Sticky Header */}
                    <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between shrink-0 bg-white">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-medium shrink-0 ${
                          isEditMode ? "bg-indigo-100 text-indigo-900" : "bg-amber-100 text-amber-900"
                        }`}>
                          {isEditMode ? <BookOpen className="w-5 h-5 text-indigo-700" /> : <ClipboardCheck className="w-5 h-5 text-amber-700" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-charcoal truncate">
                            {isEditMode ? "Edit Session Attendance" : "Weekly Roll-Call Attendance"}
                          </h3>
                          <p className="text-xs text-muted truncate">
                            {activeGroup.name} {isEditMode ? `• Updating session on ${rollCallDate}` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRollCallModalOpen(false)}
                        className="p-1.5 text-muted hover:bg-gray-100 rounded-xl cursor-pointer transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* The form scrolls while its save/cancel actions remain visible. */}
                    <div className="p-4 sm:p-5 flex-1 min-h-0 space-y-3.5 overflow-y-auto">
                      {/* Compact Session Row */}
                      <SessionDatePickerCompactRow
                        sessions={rollCallSessionsList}
                        value={rollCallDate}
                        isSpecial={isSpecialRollCall}
                        specialReason={specialRollCallReason}
                        onSpecialChange={handleSpecialChange}
                        groupScheduleText={activeGroup.meeting_day ? `Every ${activeGroup.meeting_day}${activeGroup.meeting_time ? ` • ${activeGroup.meeting_time}` : ""}` : undefined}
                        disabled={isSavingRollCall}
                        isFlyoutOpen={isRollCallFlyoutOpen}
                        onToggleFlyout={() => setIsRollCallFlyoutOpen((prev) => !prev)}
                        changeButtonRef={rollCallChangeButtonRef}
                      />

                      <fieldset className="shrink-0 space-y-2 p-3 rounded-xl border border-indigo-100 bg-indigo-50/40" disabled={isSavingRollCall}>
                        <legend className="px-1 font-semibold text-indigo-950">Book & chapter covered</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label htmlFor="roll-call-book" className="block mb-1 font-medium text-charcoal">Book / Study Topic</label>
                            <input id="roll-call-book" list="roll-call-books" required maxLength={300} value={rollCallBook}
                              onChange={e => setRollCallBook(e.target.value)} className="w-full bg-white p-2 rounded-lg border border-gray-200 text-charcoal" />
                            <datalist id="roll-call-books">{studyTopics.map(topic => <option key={topic.id} value={topic.title} />)}</datalist>
                          </div>
                          <div>
                            <label htmlFor="roll-call-chapter" className="block mb-1 font-medium text-charcoal">Chapter / Lesson</label>
                            <input id="roll-call-chapter" required maxLength={120} value={rollCallChapter}
                              onChange={e => setRollCallChapter(e.target.value)} placeholder="e.g. Chapter 3" className="w-full bg-white p-2 rounded-lg border border-gray-200 text-charcoal" />
                          </div>
                        </div>
                        <label className="flex items-start gap-2 text-charcoal cursor-pointer">
                          <input type="checkbox" checked={updateGroupProgress} disabled={!canUpdateRollCallProgress(rollCallDate, rollCallSessionsList)}
                            onChange={e => setUpdateGroupProgress(e.target.checked)} className="mt-0.5" />
                          <span>Update the group's current book and chapter when saving attendance</span>
                        </label>
                        {!canUpdateRollCallProgress(rollCallDate, rollCallSessionsList) && <p className="text-muted">This historical session records its own lesson without changing the group's current progress.</p>}
                      </fieldset>

                      {/* Mark Present Disciples Section */}
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between mb-1.5 shrink-0">
                          <label className="font-medium text-charcoal/70">Mark Present Disciples</label>
                          <span className="text-[12px] text-indigo font-medium">
                            {Object.values(rollCallAttendees).filter(Boolean).length} / {currentMembers.length} Present
                          </span>
                        </div>
                        {/* Disciples list scrolls independently */}
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                          {currentMembers.length > 0 ? (
                            currentMembers.map((m: any, idx: number) => {
                              const mId = m.member_id || m.id || idx;
                              const isPresent = rollCallAttendees[mId] ?? true;
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setRollCallAttendees(prev => ({ ...prev, [mId]: !isPresent }))}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${isPresent
                                    ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 font-medium"
                                    : "bg-gray-50 border-gray-200 text-muted"
                                    }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isPresent ? "bg-emerald-600 text-white" : "border border-gray-300"}`}>
                                      {isPresent && <Check className="w-3.5 h-3.5" />}
                                    </div>
                                    <span className="truncate">{m.member_name || `${m.first_name || ""} ${m.last_name || ""}`}</span>
                                  </div>
                                  <span className="text-[12px] uppercase font-medium shrink-0">{isPresent ? "Present" : "Absent"}</span>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-muted italic py-2 text-center">No disciples registered yet.</p>
                          )}
                        </div>
                      </div>

                      {/* Session Notes */}
                      <div className="shrink-0">
                        <label className="block font-medium text-charcoal/70 mb-1">Session Notes & Discussion Highlights</label>
                        <textarea
                          rows={2}
                          placeholder="Record chapter discussion highlights or key takeaways from this session..."
                          value={rollCallNotes}
                          onChange={(e) => setRollCallNotes(e.target.value)}
                          className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 text-charcoal focus:outline-none focus:border-indigo text-xs"
                        />
                      </div>
                    </div>

                    {/* Sticky Footer */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/90 flex items-center justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsRollCallModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 font-medium text-charcoal cursor-pointer shadow-2xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingRollCall}
                        className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-indigo-950 font-medium shadow-md cursor-pointer disabled:opacity-50 transition-all"
                      >
                        {isSavingRollCall ? "Saving..." : isEditMode ? "Update Verified Attendance" : "Log Verified Attendance"}
                      </button>
                    </div>
                  </form>

                  {/* Right Column / Mobile Bottom Sheet: Attached Flyout Panel */}
                  {isRollCallFlyoutOpen && !isSpecialRollCall && (
                    <SessionFlyoutPanel
                      sessions={rollCallSessionsList}
                      value={rollCallDate}
                      onSelect={async (session) => {
                        const ok = await handleBeforeChangeSession(session);
                        if (!ok) return;
                        handleSessionChange(session.date, session);
                        // Do not auto-close flyout on session click so leaders can switch easily
                      }}
                      onClose={() => {
                        setIsRollCallFlyoutOpen(false);
                        rollCallChangeButtonRef.current?.focus();
                      }}
                      onSpecialClick={() => {
                        setIsRollCallFlyoutOpen(false);
                        handleSpecialChange(true, new Date().toISOString().split("T")[0], "");
                      }}
                      groupScheduleText={activeGroup.meeting_day ? `Every ${activeGroup.meeting_day}${activeGroup.meeting_time ? ` • ${activeGroup.meeting_time}` : ""}` : undefined}
                      onLoadOlder={handleLoadOlderRollCallSessions}
                    />
                  )}
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* ==================================================== */}
      {/* MODAL: SEND GROUP BULLETIN */}
      {/* ==================================================== */}
      {isBulletinModalOpen && activeGroup && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-indigo-100">
            <div data-modal-header className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo flex items-center justify-center font-medium">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-charcoal">Send Group Bulletin</h3>
                  <p className="text-xs text-muted">Broadcast notice to {activeGroup.name} members</p>
                </div>
              </div>
              <button onClick={() => setIsBulletinModalOpen(false)} className="p-1.5 text-muted hover:bg-gray-100 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form data-guide="my-group-bulletin-form" onSubmit={handleSendBulletin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-charcoal/70 mb-1">Subject Header</label>
                <input
                  type="text"
                  placeholder="e.g. Thursday Fellowship Reminder & Reading Material"
                  value={bulletinSubject}
                  onChange={(e) => setBulletinSubject(e.target.value)}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-medium text-charcoal/70 mb-1">Bulletin Message *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Type your message, reading assignment, or meeting venue instructions..."
                  value={bulletinMessage}
                  onChange={(e) => setBulletinMessage(e.target.value)}
                  className="w-full bg-ivory-light p-2.5 rounded-xl border border-gray-200"
                />
              </div>

              <div data-modal-footer className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulletinModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-charcoal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingBulletin}
                  className="px-5 py-2 rounded-xl bg-indigo text-white font-medium shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSendingBulletin ? "Sending..." : "Broadcast Bulletin"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ==================================================== */}
      {/* MODAL: SHIFT SWAP REQUEST */}
      {/* ==================================================== */}
      {isSwapShiftModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-indigo-100">
            <div data-modal-header className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo flex items-center justify-center font-medium">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-charcoal">Request Duty Shift Swap</h3>
                  <p className="text-xs text-muted">Trade service date with another group</p>
                </div>
              </div>
              <button onClick={() => setIsSwapShiftModalOpen(false)} className="p-1.5 text-muted hover:bg-gray-100 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-charcoal/70">
              Please contact your church coordinator to request a duty swap for {activeGroup.name}.
            </p>
            <div data-modal-footer className="pt-2 border-t border-gray-100 flex justify-end">
              <button type="button" onClick={() => setIsSwapShiftModalOpen(false)} className="px-4 py-2 rounded-xl bg-indigo text-white font-medium text-xs">
                Close
              </button>
            </div>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD MEMBER TO GROUP (MULTI-SELECT) */}
      {/* ==================================================== */}
      {isAddDiscipleModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            {/* Header */}
            <div data-modal-header className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo flex items-center justify-center font-medium shadow-2xs">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-charcoal">Add Disciples to Group</h3>
                  <p className="text-xs text-muted font-medium">Group: <span className="font-medium text-indigo">{activeGroup?.name}</span></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddDiscipleModalOpen(false);
                  setSelectedMemberIdsToAdd([]);
                  setAddDiscipleSearchQuery("");
                  setAddDiscipleMinistryFilter("all");
                }}
                className="p-1.5 rounded-xl text-muted hover:bg-gray-100 hover:text-charcoal cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form data-guide="my-group-add-form" onSubmit={handleAddMemberToGroup} className="space-y-4 text-xs">
              {/* Search & Filter Controls */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Search Input */}
                  <div className="sm:col-span-2 relative">
                    <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search member name, phone, email..."
                      value={addDiscipleSearchQuery}
                      onChange={(e) => setAddDiscipleSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2.5 bg-ivory-light rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs font-medium text-charcoal"
                    />
                    {addDiscipleSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAddDiscipleSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Ministry Filter */}
                  <div className="relative">
                    <select
                      value={addDiscipleMinistryFilter}
                      onChange={(e) => setAddDiscipleMinistryFilter(e.target.value)}
                      className="w-full bg-ivory-light py-2.5 px-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs font-medium text-charcoal cursor-pointer truncate"
                    >
                      <option value="all">All Ministries ({availableMinistries.length})</option>
                      {availableMinistries.map((min) => (
                        <option key={min} value={min}>
                          {min}
                        </option>
                      ))}
                      <option value="none">No Ministry Assigned</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[12px] text-muted px-1 font-medium">
                  <span>
                    {filteredAvailableMembersToAdd.length} eligible {filteredAvailableMembersToAdd.length === 1 ? "member" : "members"} found
                  </span>
                  <div className="flex items-center gap-2">
                    {filteredAvailableMembersToAdd.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="text-indigo hover:text-indigo-800 hover:underline cursor-pointer font-medium"
                      >
                        Select All Filtered ({filteredAvailableMembersToAdd.length})
                      </button>
                    )}
                    {selectedMemberIdsToAdd.length > 0 && (
                      <>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={handleClearAllSelected}
                          className="text-rose-600 hover:text-rose-800 hover:underline cursor-pointer font-medium"
                        >
                          Clear ({selectedMemberIdsToAdd.length})
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Members Selection List */}
              <div className="border border-gray-200 rounded-2xl max-h-64 overflow-y-auto divide-y divide-gray-100 bg-gray-50/40 p-1">
                {filteredAvailableMembersToAdd.length === 0 ? (
                  <div className="py-8 text-center text-muted space-y-1">
                    <Users className="w-8 h-8 mx-auto text-charcoal/30" />
                    <p className="font-medium text-xs">No church members found</p>
                    <p className="text-[12px]">Try adjusting your search query or ministry filter</p>
                  </div>
                ) : (
                  filteredAvailableMembersToAdd.map((m) => {
                    const isSelected = selectedMemberIdsToAdd.includes(m.id);
                    const initials = `${m.first_name?.[0] || ""}${m.last_name?.[0] || ""}`.toUpperCase() || "M";

                    return (
                      <div
                        key={m.id}
                        onClick={() => handleToggleMemberToAdd(m.id)}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected
                          ? "bg-indigo-50/90 border border-indigo/40 shadow-xs"
                          : "hover:bg-white hover:shadow-2xs"
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Multi-select checkbox indicator */}
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${isSelected
                            ? "bg-indigo border-indigo text-white shadow-2xs"
                            : "bg-white border-gray-300 hover:border-indigo"
                            }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>

                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs shrink-0 ${isSelected
                            ? "bg-indigo text-white shadow-2xs"
                            : "bg-slate-200 text-slate-700"
                            }`}>
                            {initials}
                          </div>

                          <div className="min-w-0">
                            <div className="font-medium text-charcoal text-xs truncate">
                              {m.first_name} {m.last_name}
                            </div>
                            <div className="flex items-center gap-2 text-[12px] text-muted truncate flex-wrap">
                              {m.ministry_name ? (
                                <span className="bg-indigo-100/80 text-indigo-900 font-medium px-1.5 py-0.2 rounded-md">
                                  {m.ministry_name}
                                </span>
                              ) : (
                                <span className="text-muted italic">General Member</span>
                              )}
                              {m.contact_phone && <span>• {m.contact_phone}</span>}
                              {m.contact_email && <span className="truncate">• {m.contact_email}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isSelected ? (
                            <div className="flex items-center gap-1 bg-indigo text-white text-[12px] font-medium px-2.5 py-1 rounded-full shadow-xs">
                              <Check className="w-3 h-3" />
                              <span>Selected</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleMemberToAdd(m.id);
                              }}
                              className="px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 text-indigo font-medium border border-gray-200 hover:border-indigo-300 text-[12px] transition-colors"
                            >
                              + Select
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selected Disciples Summary Chips */}
              {selectedMemberIdsToAdd.length > 0 && (
                <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-[12px] font-medium text-indigo-900">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Selected to enroll ({selectedMemberIdsToAdd.length}):</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearAllSelected}
                      className="text-indigo-600 hover:text-rose-600 text-[12px] font-medium cursor-pointer hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {selectedMemberIdsToAdd.map((id) => {
                      const m = allMembers.find(mem => mem.id === id);
                      if (!m) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-[12px] font-medium shadow-2xs"
                        >
                          <span>{m.first_name} {m.last_name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSelectedMember(id);
                            }}
                            className="text-indigo-400 hover:text-rose-600 cursor-pointer ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div data-modal-footer className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddDiscipleModalOpen(false);
                    setSelectedMemberIdsToAdd([]);
                    setAddDiscipleSearchQuery("");
                    setAddDiscipleMinistryFilter("all");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 font-medium text-xs text-charcoal hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedMemberIdsToAdd.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-medium text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {selectedMemberIdsToAdd.length <= 1
                      ? `Enroll ${selectedMemberIdsToAdd.length === 1 ? "1 Disciple" : "Disciple"}`
                      : `Enroll ${selectedMemberIdsToAdd.length} Disciples`}
                  </span>
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* Bible Study Reschedule with Room & Day Inspector Modal */}
      <BibleStudyRescheduleModal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        group={activeGroup}
        onSaved={loadLeaderData}
      />
    </div>
  );
};

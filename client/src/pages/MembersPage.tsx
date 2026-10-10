import { FilterPanel } from "../components/common/FilterPanel";
import { PageHeader } from "../components/common/PageHeader";
import { MemberRowActions } from "../features/members/components/MemberRowActions";
import { MemberDeleteDialog } from "../features/members/components/MemberDeleteDialog";
import './members.css';
import { Pagination } from "../components/common/Pagination";
import { usePageControls, useDebouncedValue } from "../hooks/useListPagination";
import { Bell as UIBell, Briefcase as UIBriefcase, Check as UICheck, Church as UIChurch, Circle as UICircle, CircleCheck as UICircleCheck, CircleX as UICircleX, ClipboardList as UIClipboardList, Clock as UIClock, GraduationCap as UIGraduationCap, HeartHandshake as UIHeartHandshake, House as UIHouse, Info as UIInfo, Phone as UIPhone, Plus as UIPlus, UserRound as UIUserRound, Users as UIUsers, Waves as UIWaves } from "lucide-react";
import { ModalPanel } from "../components/common/ModalPanel";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import type { FamilyLinksInput } from '../types';
import { ParentsHouseholdFields } from '../features/members/components/ParentsHouseholdFields';
import { FamilyTreeModal } from '../features/members/components/FamilyTreeModal';
import { GitBranch } from 'lucide-react';
import { useGuideDataState } from "../components/help/GuideDataContext";
import { Member, Household, HouseholdFamilyMember, Ministry } from "../types";
import {
  Users, Home, Search, Plus, Filter, AlertCircle, AlertTriangle,
  Heart, Phone, Mail, Calendar, ShieldCheck, ArrowRight, X, Check,
  Cake, Gift, PartyPopper, Send, FileText, MapPin, Briefcase, GraduationCap, Clock,
  Layers, Shield, Info, ArrowLeft, School, BookOpen, Pencil, Trash2, RefreshCw,
  Upload, Image as ImageIcon, FileUp, Scan, Clipboard, Loader2, CheckCircle2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Droplets, Award, TrendingUp, Flame
} from "lucide-react";
import { DatePickerInput } from "../components/common/DatePickerInput";
import { TimePickerInput } from "../components/common/TimePickerInput";
import { AddressPicker } from "../components/common/AddressPicker";
import {
  SearchableAutocomplete,
  PHILIPPINE_HIGH_SCHOOLS,
  HIGH_SCHOOL_GRADE_LEVELS,
  PHILIPPINE_COLLEGES_UNIVERSITIES,
  PHILIPPINE_DEGREE_PROGRAMS
} from "../components/common/SearchableAutocomplete";
import { ClassSchedulePicker } from "../components/common/ClassSchedulePicker";
import { useSocketEvent } from "../socket";
import { MembersPageSkeleton, TableSkeleton } from "../components/common/SkeletonLoader";
import { analyzeMemberFile, parseMemberText, ParsedMemberData } from "../utils/memberFormParser";
import { MemberImportAnalyzeModal } from "../components/common/MemberImportAnalyzeModal";
import { ConfirmationModal, ModalType } from "../components/common/ConfirmationModal";
import { PartnerRegistrationModal, PartnerRegistrationData } from "../features/members/components/PartnerRegistrationModal";
import { MemberAttendanceSummaryModal } from "../components/common/MemberAttendanceSummaryModal";
import { HouseholdRegistrationFields } from "../features/members/components/HouseholdRegistrationFields";
import { MemberFamilyDetailsField } from "../features/members/components/MemberFamilyDetailsField";
import { RelativeRegistrationModal } from "../features/members/components/RelativeRegistrationModal";
import type { RelativeRegistrationContext } from "../features/members/types";
import { familyRelationships, familyRole, householdFamily, householdFamilyMembers, memberFamily, memberName, normalizeName, HouseholdRole, memberHouseholdRole, householdRoleLabels, parentRoles, relationshipRole } from "../features/members/householdFamily";
import { useMemberDuplicateCheck } from "../features/members/hooks/useMemberDuplicateCheck";
import { memberRegistrationService } from "../features/members/services/memberRegistrationService";
import { Button } from "../components/common/Button";
import { MemberFamilySection } from "../features/members/components/MemberFamilySection";

export const splitFullName = (fullName: string): { firstName: string; lastName: string } => {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: '', lastName: '' };

  const parts = trimmed.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  const compoundPrefixes = ['dela', 'de', 'del', 'san', 'santa', 'sta.', 'van', 'von', 'dos', 'da', 'di'];

  // Check if second-to-last word is a compound prefix like "Dela Cruz", "De Los Santos", etc.
  if (parts.length >= 3 && compoundPrefixes.includes(parts[parts.length - 2].toLowerCase())) {
    const lastName = parts.slice(parts.length - 2).join(' ');
    const firstName = parts.slice(0, parts.length - 2).join(' ');
    return { firstName, lastName };
  }

  // Check 3-part compound like "De La Cruz"
  if (parts.length >= 4 && parts[parts.length - 3].toLowerCase() === 'de' && parts[parts.length - 2].toLowerCase() === 'la') {
    const lastName = parts.slice(parts.length - 3).join(' ');
    const firstName = parts.slice(0, parts.length - 3).join(' ');
    return { firstName, lastName };
  }

  // Default: last word is lastName, all preceding words are firstName (includes given names + middle initial)
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, parts.length - 1).join(' ');
  return { firstName, lastName };
};

export const sanitizePhoneInput = (val: string): string => {
  return val.replace(/\D/g, "").slice(0, 11);
};

export const MembersPage: React.FC = () => {
  const { user, ministries, selectedMinistryId } = useAuth();
  const { showToast, deleteWithUndo } = useToast();
  const [activeTab, setActiveTab] = useState<"members" | "households">("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [allChurchMembers, setAllChurchMembers] = useState<Member[]>([]);
  const isCoordinator = user?.role_name === "Coordinator";
  const coordinatorMinistryId = isCoordinator && user?.ministries && user.ministries.length > 0
    ? user.ministries[0].id
    : (user?.role_name !== "Admin" && user?.role_name !== "Pastor" && user?.role_name !== "IT Admin" && selectedMinistryId ? selectedMinistryId : null);
  const coordinatorMinistryName = ministries.find(m => m.id === coordinatorMinistryId)?.name || "Assigned";

  const [households, setHouseholds] = useState<Household[]>([]);
  const [localMinistries, setLocalMinistries] = useState<Ministry[]>(ministries);
  const [searchQuery, setSearchQuery] = useState("");
  const householdSearch = useDebouncedValue(searchQuery);
  const householdPage = usePageControls(householdSearch, 20);
  const [householdRows, setHouseholdRows] = useState<Household[]>([]);
  const [householdTotal, setHouseholdTotal] = useState(0);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [filterMinistry, setFilterMinistry] = useState<string>(
    coordinatorMinistryId ? String(coordinatorMinistryId) : (selectedMinistryId ? String(selectedMinistryId) : "")
  );
  const [filterHousehold, setFilterHousehold] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterBirthMonth, setFilterBirthMonth] = useState<string>("");
  const [membershipFilter, setMembershipFilter] = useState<string>("all");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [relativeChoice, setRelativeChoice] = useState<RelativeRegistrationContext | null>(null);
  const [relativeRegistration, setRelativeRegistration] = useState<RelativeRegistrationContext | null>(null);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddHouseholdModalOpen, setIsAddHouseholdModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [birthdayFilter, setBirthdayFilter] = useState<string>("all");

  // Comprehensive Attendance Summary & Streaks Modal State
  const [attendanceSummaryMember, setAttendanceSummaryMember] = useState<Member | null>(null);
  const [attendanceSummaryInitialTab, setAttendanceSummaryInitialTab] = useState<"overview" | "logs" | "monthly" | "milestones" | "audit">("overview");

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

  // Greeting Modal State
  const [greetingMember, setGreetingMember] = useState<Member | null>(null);
  const [greetingMessage, setGreetingMessage] = useState<string>("");
  const [greetingSuccess, setGreetingSuccess] = useState<boolean>(false);
  const [sendingGreeting, setSendingGreeting] = useState<boolean>(false);

  // Discipleship & Outreach "See More" Modal State
  const [isInvitedMembersModalOpen, setIsInvitedMembersModalOpen] = useState(false);
  const [invitedModalSearch, setInvitedModalSearch] = useState("");
  const [invitedModalMinistryFilter, setInvitedModalMinistryFilter] = useState("all");

  // Member form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    birthdate: "",
    gender: "Male",
    civil_status: "Single",
    spouse_name: "",
    spouse_id: "",
    contact_email: "",
    contact_phone: "",
    household_id: "",
    ministry_id: coordinatorMinistryId ? String(coordinatorMinistryId) : "",
    medical_notes: "",
    grade_level: "",
    address: "",
    guardian_names: "",
    guardian_phone: "",
    invited_by: "",
    school_name: "",
    program_major: "",
    class_schedule: "",
    occupation: "",
    hobbies: "",
    previous_church: "",
    facebook_account: "",
    family_details: "",
    application_date: new Date().toISOString().split("T")[0],
    status: "active",
    is_baptized: false,
    baptism_status: "not_baptized",
    baptism_date: "",
    baptism_notes: ""
  });

  const [fullNameInput, setFullNameInput] = useState<string>("");
  const duplicateCheck = useMemberDuplicateCheck(fullNameInput, editingMember?.id, isAddModalOpen);
  const isCheckingDuplicate = duplicateCheck.state.status === "loading";
  const dbDuplicateMember = duplicateCheck.state.status === "success" ? duplicateCheck.state.member : null;

  const handleFullNameChange = (val: string) => {
    setFullNameInput(val);
    const { firstName, lastName } = splitFullName(val);
    setFormData(prev => ({
      ...prev,
      first_name: firstName,
      last_name: lastName
    }));
  };

  // Combined live duplicate match: database match + local state
  const liveDuplicateMember = useMemo(() => {
    if (dbDuplicateMember) return dbDuplicateMember;

    const trimmed = fullNameInput.trim().toLowerCase();
    if (trimmed.length < 2) return null;

    const normalizedInput = trimmed.replace(/\./g, '').replace(/\s+/g, ' ');
    const source = allChurchMembers.length > 0 ? allChurchMembers : members;

    return source.find(m => {
      if (editingMember && m.id === editingMember.id) return false;
      const mFull = `${m.first_name} ${m.last_name}`.trim().toLowerCase();
      const normalizedM = mFull.replace(/\./g, '').replace(/\s+/g, ' ');

      if (normalizedInput === normalizedM) return true;

      const { firstName, lastName } = splitFullName(fullNameInput);
      if (
        firstName && lastName &&
        m.first_name.trim().toLowerCase() === firstName.trim().toLowerCase() &&
        m.last_name.trim().toLowerCase() === lastName.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    }) || null;
  }, [fullNameInput, allChurchMembers, members, editingMember, dbDuplicateMember]);

  // Spouse creation sub-form state (if spouse is not yet in member directory)
  const [createNewSpouseRecord, setCreateNewSpouseRecord] = useState<boolean>(false);
  const [registrationStep, setRegistrationStep] = useState<"member" | "partner">("member");
  const [isSavingMember, setIsSavingMember] = useState(false);
  const memberFormRef = useRef<HTMLFormElement>(null);
  const backToMember = () => {
    setRegistrationStep("member");
    requestAnimationFrame(() => memberFormRef.current?.querySelector<HTMLButtonElement>('[data-guide="member-save"]')?.focus());
  };
  const [spouseFormData, setSpouseFormData] = useState<PartnerRegistrationData>({
    first_name: "",
    last_name: "",
    birthdate: "",
    gender: "Female",
    application_date: new Date().toISOString().split("T")[0],
    contact_phone: "",
    contact_email: "",
    address: "",
    same_address_as_member: true,
    same_inviter_as_member: true,
    occupation: "",
    facebook_account: "",
    family_details: "",
    hobbies: "",
    invited_by: "",
    previous_church: "",
    medical_notes: ""
  });

  const [youthStatus, setYouthStatus] = useState<"student" | "graduated">("student");
  const [gradWorkStatus, setGradWorkStatus] = useState<"with_work" | "no_work">("with_work");
  const [suggestedMinistryInfo, setSuggestedMinistryInfo] = useState<{ age: number; ministry: Ministry | null } | null>(null);

  // File Import & Document/Image Analyzer State
  const [isImportAnalyzeModalOpen, setIsImportAnalyzeModalOpen] = useState<boolean>(false);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState<boolean>(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [analyzedFeedback, setAnalyzedFeedback] = useState<{ count: number; message: string; autoFilledKeys: string[] } | null>(null);

  const [pasteRawText, setPasteRawText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Household form state
  // Household form state
  const [householdForm, setHouseholdForm] = useState({
    name: "",
    address: "",
    primary_contact_phone: "",
    father_name: "",
    mother_name: "",
    guardian_name: ""
  });
  const [editingHousehold, setEditingHousehold] = useState<Household | null>(null);
  const [isSavingHousehold, setIsSavingHousehold] = useState(false);
  const familyRowCounter = useRef(0);
  const [householdFamilyDraft, setHouseholdFamilyDraft] = useState<(HouseholdFamilyMember & { key: number })[]>([]);
  const [householdFamilyError, setHouseholdFamilyError] = useState("");
  const availableFamilyMembers = (allChurchMembers.length ? allChurchMembers : members)
    .filter(member => !member.household_id || member.household_id === editingHousehold?.id);

  // Household & Family Linkage State in Add/Edit Member Form
  const [householdMode, setHouseholdMode] = useState<"create_new" | "existing" | "none">("existing");
  const [newHouseholdName, setNewHouseholdName] = useState<string>("");
  const [parentNameDirty, setParentNameDirty] = useState(false);
  const [spouseSearchQuery, setSpouseSearchQuery] = useState<string>("");
  const [householdRegistrationRole, setHouseholdRegistrationRole] = useState<HouseholdRole | "">("");
  useEffect(() => {
    if (formData.civil_status === 'Married' && ['father','mother'].includes(householdRegistrationRole)) {
      setHouseholdRegistrationRole(householdRegistrationRole === 'father' ? 'husband' : 'wife');
    }
  }, [formData.civil_status, householdRegistrationRole]);
  const [registrationFamilyMembers, setRegistrationFamilyMembers] = useState<HouseholdFamilyMember[]>([]);
  const [familyLinks,setFamilyLinks] = useState<FamilyLinksInput|undefined>();
  const [treeHousehold,setTreeHousehold] = useState<Household|null>(null);

  const linkedHousehold = householdMode === "existing"
    ? households.find(h => h.id === Number(formData.household_id)) : undefined;
  const linkedFamily = householdFamily(linkedHousehold);
  const isHouseholdParent = [...parentRoles,'husband','wife'].includes(householdRegistrationRole as any) ||
    (!!linkedHousehold && !!familyRole(linkedHousehold, memberName(formData)));
  const useHouseholdGuardian = !!linkedFamily.primaryParent && !parentNameDirty && !isHouseholdParent;
  const applicationGuardianName = useHouseholdGuardian ? linkedFamily.primaryParent : formData.guardian_names;
  const applicationGuardianPhone = useHouseholdGuardian ? linkedFamily.primaryPhone || formData.guardian_phone || linkedHousehold?.primary_contact_phone || "" : formData.guardian_phone;
  const applicationFamilyDetails = formData.family_details;
  const selectedHousehold = households.find(h => h.id === selectedMember?.household_id);
  const selectedFamily = memberFamily(selectedHousehold, selectedMember?.family_details);
  const selectedGuardian = selectedHousehold && selectedMember && !familyRole(selectedHousehold, memberName(selectedMember))
    ? selectedFamily.primaryParent || selectedMember.guardian_names
    : selectedMember?.guardian_names;
  const selectedFamilyDetails = selectedFamily.summary || selectedMember?.family_details;
  const selectedGuardianPhone = selectedFamily.primaryParent === selectedGuardian
    ? selectedFamily.primaryPhone || selectedMember?.guardian_phone || selectedHousehold?.primary_contact_phone
    : selectedMember?.guardian_phone;

  const openHouseholdForm = (household: Household | null = null) => {
    setEditingHousehold(household);
    let fName = household?.father_name?.trim() || "";
    let mName = household?.mother_name?.trim() || "";
    const head = household?.members?.find(member => normalizeName(memberName(member)) === normalizeName(fName || mName));
    const spouse = head && household?.members?.find(member => member.id === head.spouse_id || member.spouse_id === head.id);
    if (spouse && fName && !mName) mName = memberName(spouse);
    else if (spouse && mName && !fName) fName = memberName(spouse);
    const gName = household?.guardian_name?.trim() || "";
    const isParent = (n: string) => {
      const norm = normalizeName(n);
      return (fName && norm === normalizeName(fName)) || (mName && norm === normalizeName(mName)) || (gName && norm === normalizeName(gName));
    };
    const otherMembers = householdFamilyMembers(household)
      .filter(entry => !isParent(entry.name))
      .map(entry => ({ ...entry, key: ++familyRowCounter.current }));
    setHouseholdFamilyDraft(otherMembers);
    setHouseholdFamilyError("");
    setHouseholdForm({
      name: household?.name || "",
      address: household?.address || "",
      primary_contact_phone: household?.primary_contact_phone || "",
      father_name: fName,
      mother_name: mName,
      guardian_name: gName
    });
    setIsAddHouseholdModalOpen(true);
  };

  const updateHouseholdFamilyName = (key: number, name: string) => {
    const normalized = normalizeName(name);
    const member = availableFamilyMembers.find(m => normalizeName(memberName(m)) === normalized);
    setHouseholdFamilyDraft(prev => prev.map(entry => entry.key === key ? { ...entry, name, member_id: member?.id || null } : entry));
    setHouseholdFamilyError("");
  };

  const handleGuardianNameChange = (name: string) => {
    setParentNameDirty(true);
    setFormData(prev => ({ ...prev, guardian_names: name }));
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const directoryToolbarRef = useRef<HTMLDivElement>(null);
  const memberListRef = useRef<HTMLDivElement>(null);
  const memberPaginationRef = useRef<HTMLDivElement>(null);
  const [memberListMaxHeight, setMemberListMaxHeight] = useState<number>();
  const isInitialMemberLoad = loading && !hasLoaded;

  useEffect(() => {
    const toolbar = directoryToolbarRef.current;
    const pagination = memberPaginationRef.current;
    const workspace = toolbar?.closest("main");
    if (!toolbar || !pagination || !workspace) return;

    // Reserve room for the controls and pagination inside the app's scroll area.
    const resizeList = () => {
      const styles = getComputedStyle(workspace);
      const gutters = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      setMemberListMaxHeight(Math.max(160,
        workspace.clientHeight - toolbar.offsetHeight - pagination.offsetHeight - gutters - 24
      ));
    };
    const observer = new ResizeObserver(resizeList);
    [workspace, toolbar, pagination].forEach(element => observer.observe(element));
    resizeList();
    return () => observer.disconnect();
  }, [activeTab, isInitialMemberLoad]);

  useEffect(() => {
    if (memberListRef.current) memberListRef.current.scrollTop = 0;
  }, [currentPage, pageSize, searchQuery, filterMinistry, membershipFilter, birthdayFilter]);

  const effectiveMinistries = localMinistries && localMinistries.length > 0 ? localMinistries : ministries;
  const currentModalMinistryId = formData.ministry_id
    ? Number(formData.ministry_id)
    : (coordinatorMinistryId || suggestedMinistryInfo?.ministry?.id || null);
  const currentModalMinistry = effectiveMinistries.find(m => m.id === currentModalMinistryId) || suggestedMinistryInfo?.ministry || null;
  const currentMinName = (currentModalMinistry?.name || "").toLowerCase();
  const isJuniorAdult = currentMinName.includes("junior");
  const canCreateHousehold = isJuniorAdult || currentMinName.includes("old") || currentMinName.includes("senior");

  useEffect(() => {
    if (isAddModalOpen && householdMode === "create_new" && !canCreateHousehold) {
      setHouseholdMode("existing");
      setHouseholdRegistrationRole("");
      setRegistrationFamilyMembers([]);
    }
  }, [isAddModalOpen, householdMode, canCreateHousehold]);

  useEffect(() => {
    if (coordinatorMinistryId) {
      setFilterMinistry(String(coordinatorMinistryId));
      setFormData(prev => ({ ...prev, ministry_id: String(coordinatorMinistryId) }));
    } else if (selectedMinistryId) {
      setFilterMinistry(String(selectedMinistryId));
    }
  }, [coordinatorMinistryId, selectedMinistryId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadData(1);
    }, 200);
    return () => clearTimeout(handler);
  }, [filterMinistry, coordinatorMinistryId, searchQuery, birthdayFilter, membershipFilter, pageSize]);

  // Real-time automatic sync via Socket.IO
  useSocketEvent("members:changed", () => {
    loadData(currentPage);
  }, [filterMinistry, coordinatorMinistryId, currentPage, pageSize]);

  useSocketEvent("households:changed", () => {
    setDirectoryRevision(value => value + 1);
    loadData(currentPage);
  });

  useSocketEvent("ministries:changed", () => {
    loadData(currentPage);
  });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setHouseholdLoading(true);
    api.getHouseholdsPage({ page: householdPage.page, limit: householdPage.pageSize, search: householdSearch }, controller.signal).then(result => {
      if (!active) return;
      const rows = Array.isArray(result) ? result : result.data;
      setHouseholdRows(Array.isArray(result) ? rows.slice((householdPage.page - 1) * householdPage.pageSize, householdPage.page * householdPage.pageSize) : rows);
      setHouseholdTotal(Array.isArray(result) ? result.length : result.pagination.total);
      setHouseholds(current => [...current.filter(item => !rows.some(row => row.id === item.id)), ...rows]);
      if (!Array.isArray(result) && result.pagination.page !== householdPage.page) householdPage.setPage(result.pagination.page);
    }).catch(error => { if (active) guideData.reportError(error); }).finally(() => { if (active) setHouseholdLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [householdPage.page, householdPage.pageSize, householdSearch, directoryRevision]);

  // Family and relationship tools need their reference options only while open.
  useEffect(() => {
    if (!isAddModalOpen && !isAddHouseholdModalOpen && !selectedMember && !treeHousehold && !relativeChoice && !relativeRegistration) return;
    let active = true;
    Promise.all([api.getMembers(), api.getHouseholds()]).then(([membersResult, householdResult]) => {
      if (!active) return;
      setAllChurchMembers(Array.isArray(membersResult) ? membersResult : membersResult.data || []);
      setHouseholds(householdResult);
    }).catch(error => { if (active) guideData.reportError(error); });
    return () => { active = false; };
  }, [isAddModalOpen, isAddHouseholdModalOpen, selectedMember?.id, treeHousehold?.id, relativeChoice, relativeRegistration, directoryRevision]);

  const memberRequestSequence = useRef(0);
  const loadData = async (pageToFetch: number = currentPage) => {
    const sequence = ++memberRequestSequence.current;
    guideData.clearError();
    try {
      setLoading(true);
      const activeMinistryParam = coordinatorMinistryId
        ? coordinatorMinistryId
        : (filterMinistry ? Number(filterMinistry) : undefined);

      const isHealthFilter = ["warning", "action_required"].includes(membershipFilter);
      const isMembershipTypeFilter = ["baptized_regular", "unbaptized_regular", "guest", "inactive"].includes(membershipFilter);

      const [mRes, minList, householdResult] = await Promise.all([
        api.getMembers({
          ministry_id: activeMinistryParam,
          search: searchQuery || undefined,
          birthday_filter: birthdayFilter !== "all" ? birthdayFilter : undefined,
          membership_filter: isMembershipTypeFilter ? membershipFilter : undefined,
          attendance_health_filter: isHealthFilter ? membershipFilter : undefined,
          page: pageToFetch,
          limit: pageSize
        }),
        api.getMinistries().catch(() => []),
        api.getHouseholdsPage({ page: householdPage.page, limit: householdPage.pageSize, search: householdSearch })
      ]);
      if (sequence !== memberRequestSequence.current) return;
      const householdList = Array.isArray(householdResult) ? householdResult : householdResult.data;
      setHouseholdRows(Array.isArray(householdResult) ? householdList.slice((householdPage.page - 1) * householdPage.pageSize, householdPage.page * householdPage.pageSize) : householdList);
      setHouseholdTotal(Array.isArray(householdResult) ? householdResult.length : householdResult.pagination.total);
      setHouseholds(current => [...current.filter(item => !householdList.some(row => row.id === item.id)), ...householdList]);

      if (mRes && typeof mRes === "object" && "data" in mRes) {
        setMembers(mRes.data || []);
        setTotalRecords(mRes.pagination?.total || 0);
        setTotalPages(mRes.pagination?.totalPages || 1);
        setCurrentPage(mRes.pagination?.page || pageToFetch);
      } else if (Array.isArray(mRes)) {
        setMembers(mRes);
        setTotalRecords(mRes.length);
        setTotalPages(Math.ceil(mRes.length / pageSize) || 1);
      }

      if (minList && minList.length > 0) {
        setLocalMinistries(minList);
      }
    } catch (err) {
      console.error("Failed to load members/households:", err);
      if (sequence === memberRequestSequence.current) guideData.reportError(err);
    } finally {
      if (sequence === memberRequestSequence.current) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    loadData(newPage);
  };

  const calculateClientAge = (bdate: string): number => {
    if (!bdate) return 0;
    const b = new Date(bdate);
    if (isNaN(b.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) {
      age--;
    }
    return Math.max(0, age);
  };

  const getSuggestedMinistryForAge = (age: number) => {
    if (!effectiveMinistries || effectiveMinistries.length === 0) return null;
    const sorted = [...effectiveMinistries].sort((a, b) => (a.min_age ?? 0) - (b.min_age ?? 0));
    let matched = sorted.find(m => {
      const min = m.min_age ?? 0;
      const max = m.max_age ?? 999;
      return age >= min && age <= max;
    });
    return matched || sorted[sorted.length - 1] || null;
  };

  // Real-time age and ministry calculation when user enters birthdate in Add Member form
  const handleBirthdateChange = async (birthdateVal: string) => {
    if (!birthdateVal) {
      setFormData(prev => ({ ...prev, birthdate: "" }));
      setSuggestedMinistryInfo(null);
      return;
    }

    // Instant local calculation for zero-latency UI autofill
    const age = calculateClientAge(birthdateVal);
    const localSuggested = getSuggestedMinistryForAge(age);
    const jaMin = effectiveMinistries.find(m => m.name.toLowerCase().includes("junior"));
    const isJAorOA = localSuggested && (
      localSuggested.name.toLowerCase().includes("junior") ||
      localSuggested.name.toLowerCase().includes("old") ||
      localSuggested.name.toLowerCase().includes("senior")
    );

    if (localSuggested) {
      setSuggestedMinistryInfo({ age, ministry: localSuggested });
      if (!coordinatorMinistryId) {
        setFormData(prev => ({
          ...prev,
          birthdate: birthdateVal,
          civil_status: isJAorOA ? (prev.civil_status === "Widowed" ? "Widowed" : "Married") : "Single",
          ministry_id: prev.civil_status === "Married" && jaMin && !isJAorOA
            ? String(jaMin.id)
            : (prev.ministry_id ? prev.ministry_id : String(localSuggested.id))
        }));
        if (isJAorOA) {
          if (householdMode === "none") setHouseholdMode("create_new");
        }
      } else {
        setFormData(prev => ({ ...prev, birthdate: birthdateVal }));
      }
    } else {
      setFormData(prev => ({ ...prev, birthdate: birthdateVal }));
    }

    // Server-verified calculation
    try {
      const res = await api.suggestMinistry(birthdateVal);
      setSuggestedMinistryInfo({ age: res.calculated_age, ministry: res.suggested_ministry });
      if (res.suggested_ministry?.id && !coordinatorMinistryId) {
        const resIsJAorOA = res.suggested_ministry.name.toLowerCase().includes("junior") ||
          res.suggested_ministry.name.toLowerCase().includes("old") ||
          res.suggested_ministry.name.toLowerCase().includes("senior");
        setFormData(prev => ({
          ...prev,
          civil_status: resIsJAorOA ? (prev.civil_status === "Widowed" ? "Widowed" : "Married") : "Single",
          ministry_id: prev.ministry_id ? prev.ministry_id : String(res.suggested_ministry.id)
        }));
        if (resIsJAorOA) {
          if (householdMode === "none") setHouseholdMode("create_new");
        }
      }
    } catch (err) {
      console.error("Age calculation error:", err);
    }
  };

  const handleCivilStatusChange = (status: string) => {
    if (status === "Married") {
      setFormData(prev => ({
        ...prev,
        civil_status: "Married"
      }));
      setHouseholdMode(canCreateHousehold && !relativeRegistration ? "create_new" : "existing");
      if (!newHouseholdName) {
        setNewHouseholdName(`${formData.last_name ? `${formData.last_name} Household` : "New Family Household"}`);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        civil_status: "Widowed",
        spouse_id: "",
        spouse_name: ""
      }));
      setSpouseSearchQuery("");
      setCreateNewSpouseRecord(false);
      setRegistrationStep("member");
    }
  };

  const handleOpenAdd = () => {
    setFamilyLinks(undefined);
    setRelativeRegistration(null);
    setEditingMember(null);
    setHouseholdRegistrationRole("");
    setRegistrationFamilyMembers([]);
    setParentNameDirty(false);
    setFormData({
      first_name: "",
      last_name: "",
      birthdate: "",
      gender: "Male",
      civil_status: "Single",
      spouse_name: "",
      spouse_id: "",
      contact_email: "",
      contact_phone: "",
      household_id: "",
      ministry_id: coordinatorMinistryId ? String(coordinatorMinistryId) : "",
      medical_notes: "",
      grade_level: "",
      address: "",
      guardian_names: "",
      guardian_phone: "",
      invited_by: "",
      school_name: "",
      program_major: "",
      class_schedule: "",
      occupation: "",
      hobbies: "",
      previous_church: "",
      facebook_account: "",
      family_details: "",
      application_date: new Date().toISOString().split("T")[0],
      status: "active",
      is_baptized: false,
      baptism_status: "not_baptized",
      baptism_date: "",
      baptism_notes: ""
    });
    setHouseholdMode("existing");
    setNewHouseholdName("");
    setSpouseSearchQuery("");
    setCreateNewSpouseRecord(false);
    setRegistrationStep("member");
    setSpouseFormData({
      first_name: "",
      last_name: "",
      birthdate: "",
      gender: "Female",
      application_date: new Date().toISOString().split("T")[0],
      contact_phone: "",
      contact_email: "",
      address: "",
      same_address_as_member: true,
      same_inviter_as_member: true,
      occupation: "",
      facebook_account: "",
      family_details: "",
      hobbies: "",
      invited_by: "",
      previous_church: "",
      medical_notes: ""
    });
    setYouthStatus("student");
    setGradWorkStatus("with_work");
    setSuggestedMinistryInfo(null);
    setImportedFileName(null);
    setAnalyzedFeedback(null);

    setPasteRawText("");
    setFullNameInput("");
    setIsAddModalOpen(true);
  };

  const registerRelative = (context: RelativeRegistrationContext, relationship: string) => {
    handleOpenAdd();
    const role = relationshipRole(relationship);
    const family = householdFamily(context.household);
    const { firstName, lastName } = splitFullName(context.name);
    setFullNameInput(context.name);
    setHouseholdRegistrationRole(role);
    setRelativeRegistration({ ...context, relationship });
    setFormData(prev => ({
      ...prev, first_name: firstName, last_name: lastName,
      gender: ["mother", "daughter", "grandmother", "granddaughter", "sister"].includes(role) ? "Female" : "Male",
      household_id: String(context.household.id),
      address: context.household.address || context.sourceMember.address || "",
      guardian_names: parentRoles.includes(role as any) ? "" : family.primaryParent,
      guardian_phone: parentRoles.includes(role as any) ? "" : family.primaryPhone || context.household.primary_contact_phone || ""
    }));
    setRelativeChoice(null);
    setSelectedMember(null);
  };

  const linkRelative = async (context: RelativeRegistrationContext, member: Member, relationship: string) => {
    await memberRegistrationService.linkRelative(context, member, relationship);
    setRelativeChoice(null);
    await loadData();
    setSelectedMember(await api.getMember(context.sourceMember.id).catch(() => context.sourceMember));
    showToast(`${memberName(member)} is now linked to ${context.household.name}.`, "success");
  };

  const closeMemberForm = () => {
    setIsAddModalOpen(false);
    if (relativeRegistration) setSelectedMember(relativeRegistration.sourceMember);
    setRelativeRegistration(null);
  };

  const handleOpenAddWithImport = () => {
    setIsImportAnalyzeModalOpen(true);
  };

  const applyParsedDataToForm = (parsed: ParsedMemberData, sourceName: string) => {
    setFormData(prev => {
      const updated = { ...prev };
      const autoFilledKeys: string[] = [];

      // Update fields only if detected; unprovided fields safely remain as is / empty!
      if (parsed.first_name) { updated.first_name = parsed.first_name; autoFilledKeys.push("First Name"); }
      if (parsed.last_name) { updated.last_name = parsed.last_name; autoFilledKeys.push("Last Name"); }
      if (parsed.first_name || parsed.last_name) {
        setFullNameInput(`${updated.first_name || ""} ${updated.last_name || ""}`.trim());
      }
      if (parsed.birthdate) { updated.birthdate = parsed.birthdate; autoFilledKeys.push("Birthdate"); }
      if (parsed.gender) { updated.gender = parsed.gender; }
      if (parsed.civil_status) { updated.civil_status = parsed.civil_status; autoFilledKeys.push("Civil Status"); }
      if (parsed.spouse_name) { updated.spouse_name = parsed.spouse_name; autoFilledKeys.push("Spouse Name"); }
      if (parsed.contact_email) { updated.contact_email = parsed.contact_email; autoFilledKeys.push("Email"); }
      if (parsed.contact_phone) { updated.contact_phone = parsed.contact_phone; autoFilledKeys.push("Phone"); }
      if (parsed.address) { updated.address = parsed.address; autoFilledKeys.push("Address"); }
      if (parsed.guardian_names) { updated.guardian_names = parsed.guardian_names; autoFilledKeys.push("Guardian/Parents"); }
      if (parsed.guardian_phone) { updated.guardian_phone = parsed.guardian_phone; autoFilledKeys.push("Guardian Phone"); }
      if (parsed.school_name) { updated.school_name = parsed.school_name; autoFilledKeys.push("School"); }
      if (parsed.grade_level) { updated.grade_level = parsed.grade_level; autoFilledKeys.push("Grade Level"); }
      if (parsed.program_major) { updated.program_major = parsed.program_major; autoFilledKeys.push("Program/Course"); }
      if (parsed.class_schedule) { updated.class_schedule = parsed.class_schedule; autoFilledKeys.push("Class Schedule"); }
      if (parsed.occupation) { updated.occupation = parsed.occupation; autoFilledKeys.push("Occupation"); }
      if (parsed.hobbies) { updated.hobbies = parsed.hobbies; autoFilledKeys.push("Hobbies/Skills"); }
      if (parsed.previous_church) { updated.previous_church = parsed.previous_church; autoFilledKeys.push("Previous Church"); }
      if (parsed.facebook_account) { updated.facebook_account = parsed.facebook_account; autoFilledKeys.push("Facebook"); }
      if (parsed.invited_by) { updated.invited_by = parsed.invited_by; autoFilledKeys.push("Invited By"); }
      if (parsed.medical_notes) { updated.medical_notes = parsed.medical_notes; autoFilledKeys.push("Medical Notes"); }
      if (parsed.family_details) { updated.family_details = parsed.family_details; autoFilledKeys.push("Family Details"); }
      if (parsed.application_date) { updated.application_date = parsed.application_date; }

      // If marked married or extracted as married, assign to Junior Adult
      if (parsed.civil_status === "Married" || updated.civil_status === "Married") {
        const jaMin = effectiveMinistries.find(m => m.name.toLowerCase().includes("junior"));
        if (jaMin && !coordinatorMinistryId) {
          updated.ministry_id = String(jaMin.id);
        }
      } else if (parsed.birthdate) {
        // Also trigger age calculation & suggested ministry if birthday was extracted
        const calculatedAge = calculateClientAge(parsed.birthdate);
        const matched = effectiveMinistries.find(
          (m) => (m.min_age ?? 0) <= calculatedAge && (m.max_age ?? 999) >= calculatedAge
        ) || null;
        setSuggestedMinistryInfo({ age: calculatedAge, ministry: matched });
        if (!coordinatorMinistryId && matched) {
          updated.ministry_id = String(matched.id);
        }
      }

      setAnalyzedFeedback({
        count: parsed.detectedFieldsCount,
        message: parsed.detectedFieldsCount > 0
          ? `Successfully analyzed "${sourceName}" — auto-filled ${parsed.detectedFieldsCount} fields. Other fields remain empty for manual entry.`
          : `Analyzed "${sourceName}" — no standard member fields could be matched. Fields left empty.`,
        autoFilledKeys
      });

      return updated;
    });
  };

  const handleOpenEdit = (member: Member) => {
    setFamilyLinks(undefined);
    setRelativeRegistration(null);
    setHouseholdRegistrationRole("");
    setRegistrationFamilyMembers([]);
    setEditingMember(member);
    setParentNameDirty(false);
    setFullNameInput(`${member.first_name || ""} ${member.last_name || ""}`.trim());
    const formatDateStr = (d?: string | null) => {
      if (!d) return "";
      return typeof d === "string" ? d.split("T")[0] : new Date(d).toISOString().split("T")[0];
    };
    setFormData({
      first_name: member.first_name || "",
      last_name: member.last_name || "",
      birthdate: formatDateStr(member.birthdate),
      gender: member.gender || "Male",
      civil_status: member.civil_status || "Single",
      spouse_name: member.spouse_name || "",
      spouse_id: member.spouse_id ? String(member.spouse_id) : "",
      contact_email: member.contact_email || "",
      contact_phone: member.contact_phone || "",
      household_id: member.household_id ? String(member.household_id) : "",
      ministry_id: member.ministry_id ? String(member.ministry_id) : (coordinatorMinistryId ? String(coordinatorMinistryId) : ""),
      medical_notes: member.medical_notes || "",
      grade_level: member.grade_level || "",
      address: member.address || "",
      guardian_names: member.guardian_names || "",
      guardian_phone: member.guardian_phone || "",
      invited_by: member.invited_by || "",
      school_name: member.school_name || "",
      program_major: member.program_major || "",
      class_schedule: member.class_schedule || "",
      occupation: member.occupation || "",
      hobbies: member.hobbies || "",
      previous_church: member.previous_church || "",
      facebook_account: member.facebook_account || "",
      family_details: member.family_details || "",
      application_date: formatDateStr(member.application_date) || new Date().toISOString().split("T")[0],
      status: member.status || "active",
      is_baptized: member.is_baptized || (member.baptism_status === "baptized"),
      baptism_status: member.baptism_status || (member.is_baptized ? "baptized" : "not_baptized"),
      baptism_date: formatDateStr(member.baptism_date),
      baptism_notes: member.baptism_notes || ""
    });
    setCreateNewSpouseRecord(false);
    setSpouseSearchQuery("");
    setRegistrationStep("member");
    setSpouseFormData({
      first_name: "",
      last_name: "",
      birthdate: "",
      gender: member.gender === "Male" ? "Female" : "Male",
      application_date: new Date().toISOString().split("T")[0],
      contact_phone: "",
      contact_email: "",
      address: "",
      same_address_as_member: true,
      same_inviter_as_member: true,
      occupation: "",
      facebook_account: "",
      family_details: "",
      hobbies: "",
      invited_by: "",
      previous_church: "",
      medical_notes: ""
    });

    setHouseholdMode(member.household_id ? "existing" : "none");
    setHouseholdRegistrationRole(memberHouseholdRole(households.find(h => h.id === member.household_id), member));
    setNewHouseholdName("");

    if (member.occupation && member.occupation.trim() !== "") {
      setYouthStatus("graduated");
      if (
        member.occupation.toLowerCase().includes("no work") ||
        member.occupation.toLowerCase() === "unemployed" ||
        member.occupation.toLowerCase() === "none"
      ) {
        setGradWorkStatus("no_work");
      } else {
        setGradWorkStatus("with_work");
      }
    } else {
      setYouthStatus("student");
      setGradWorkStatus("with_work");
    }

    if (member.birthdate) {
      const calculatedAge = calculateClientAge(member.birthdate);
      const matched = effectiveMinistries.find(
        (m) => (m.min_age ?? 0) <= calculatedAge && (m.max_age ?? 999) >= calculatedAge
      ) || null;
      setSuggestedMinistryInfo({ age: calculatedAge, ministry: matched });
    } else {
      setSuggestedMinistryInfo(null);
    }
    setIsAddModalOpen(true);
  };

  const handleSubmitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingMember) return;
    if (householdMode === "create_new" && !canCreateHousehold) {
      showToast("Create New is available only for Junior Adult and Old Adult members.", "error");
      return;
    }
    const { firstName, lastName } = splitFullName(fullNameInput);
    const effectiveFirstName = firstName || formData.first_name.trim();
    const effectiveLastName = lastName || formData.last_name.trim() || effectiveFirstName;
    if (relativeRegistration && !lastName) {
      showToast("Enter this relative's complete name before registering.", "error");
      return;
    }

    try {
      if (!fullNameInput.trim() || (!effectiveFirstName && !effectiveLastName)) {
        setConfirmModalConfig({
          isOpen: true,
          title: "Full Name Required",
          type: "warning",
          confirmText: "Okay",
          cancelText: null,
          description: <p className="text-xs text-charcoal/80 text-center">Please enter the member's complete name (e.g. Mark Andrie M. Remot).</p>,
          onConfirm: () => setConfirmModalConfig(p => ({ ...p, isOpen: false }))
        });
        return;
      }

      if (!formData.birthdate) {
        setConfirmModalConfig({
          isOpen: true,
          title: "Birthdate Required",
          type: "warning",
          confirmText: "Okay",
          cancelText: null,
          description: <p className="text-xs text-charcoal/80 text-center">Please enter a valid birthdate for this member.</p>,
          onConfirm: () => setConfirmModalConfig(p => ({ ...p, isOpen: false }))
        });
        return;
      }

      if (new Date(formData.birthdate) > new Date()) {
        setConfirmModalConfig({
          isOpen: true,
          title: "Invalid Birthdate",
          type: "warning",
          confirmText: "Okay",
          cancelText: null,
          description: <p className="text-xs text-charcoal/80 text-center">Birthdate cannot be in the future.</p>,
          onConfirm: () => setConfirmModalConfig(p => ({ ...p, isOpen: false }))
        });
        return;
      }

      if (formData.contact_email && formData.contact_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email.trim())) {
        setConfirmModalConfig({
          isOpen: true,
          title: "Invalid Email Address",
          type: "warning",
          confirmText: "Okay",
          cancelText: null,
          description: <p className="text-xs text-charcoal/80 text-center">Please enter a valid email format (e.g. name@domain.com).</p>,
          onConfirm: () => setConfirmModalConfig(p => ({ ...p, isOpen: false }))
        });
        return;
      }

      // Check duplicate member by full name
      if (liveDuplicateMember) {
        setConfirmModalConfig({
          isOpen: true,
          title: "Duplicate Member Detected",
          type: "warning",
          confirmText: "Close",
          cancelText: null,
          description: (
            <p className="text-xs text-charcoal/80 text-center">
              A member named <strong>"{liveDuplicateMember.first_name} {liveDuplicateMember.last_name}"</strong> already exists in the system (ID #{liveDuplicateMember.id}).
            </p>
          ),
          onConfirm: () => setConfirmModalConfig(p => ({ ...p, isOpen: false }))
        });
        return;
      }

      // Check duplicate email
      if (formData.contact_email && formData.contact_email.trim()) {
        const dupEmail = members.find(m =>
          m.contact_email &&
          m.contact_email.toLowerCase().trim() === formData.contact_email.toLowerCase().trim() &&
          m.id !== editingMember?.id
        );
        if (dupEmail) {
          setConfirmModalConfig({
            isOpen: true,
            title: "Duplicate Email Detected",
            type: "warning",
            confirmText: "Close",
            cancelText: null,
            description: (
              <p className="text-xs text-charcoal/80 text-center">
                The email <strong>"{formData.contact_email.trim()}"</strong> is already registered to <strong>"{dupEmail.first_name} {dupEmail.last_name}"</strong>.
              </p>
            ),
            onConfirm: () => setConfirmModalConfig(p => ({ ...p, isOpen: false }))
          });
          return;
        }
      }

      // Check phone format (Must be 11 digits starting with 09)
      if (formData.contact_phone && formData.contact_phone.trim()) {
        const cleanPhone = formData.contact_phone.replace(/\D/g, '');
        if (cleanPhone.length !== 11 || !cleanPhone.startsWith('09')) {
          setConfirmModalConfig({
            isOpen: true,
            title: "Invalid Contact Number",
            type: "warning",
            confirmText: "Okay",
            cancelText: null,
            description: (
              <p className="text-xs text-charcoal/80 text-center">
                Contact number must be an <strong>11-digit Philippine mobile number</strong> starting with <strong>09</strong> (e.g. <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-indigo-700">09123456789</code>).
              </p>
            ),
            onConfirm: () => setConfirmModalConfig(p => ({ ...p, isOpen: false }))
          });
          return;
        }
      }

      // Check guardian phone format
      if (applicationGuardianPhone && applicationGuardianPhone.trim()) {
        const cleanGPhone = applicationGuardianPhone.replace(/\D/g, '');
        if (cleanGPhone.length !== 11 || !cleanGPhone.startsWith('09')) {
          setConfirmModalConfig({
            isOpen: true,
            title: "Invalid Guardian Contact Number",
            type: "warning",
            confirmText: "Okay",
            cancelText: null,
            description: (
              <p className="text-xs text-charcoal/80 text-center">
                Guardian contact number must be an <strong>11-digit Philippine mobile number</strong> starting with <strong>09</strong> (e.g. <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-indigo-700">09123456789</code>).
              </p>
            ),
            onConfirm: () => setConfirmModalConfig(p => ({ ...p, isOpen: false }))
          });
          return;
        }
      }

      // Check partner phone format if registering partner
      if (createNewSpouseRecord && registrationStep === "partner" && spouseFormData.contact_phone && spouseFormData.contact_phone.trim()) {
        const cleanSPhone = spouseFormData.contact_phone.replace(/\D/g, '');
        if (cleanSPhone.length !== 11 || !cleanSPhone.startsWith('09')) {
          setConfirmModalConfig({
            isOpen: true,
            title: "Invalid Partner Contact Number",
            type: "warning",
            confirmText: "Okay",
            cancelText: null,
            description: (
              <p className="text-xs text-charcoal/80 text-center">
                Partner contact number must be an <strong>11-digit Philippine mobile number</strong> starting with <strong>09</strong> (e.g. <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-indigo-700">09123456789</code>).
              </p>
            ),
            onConfirm: () => setConfirmModalConfig(p => ({ ...p, isOpen: false }))
          });
          return;
        }
      }

      // Check duplicate phone
      if (formData.contact_phone && formData.contact_phone.trim()) {
        const cleanPhone = formData.contact_phone.trim().replace(/[^0-9]/g, '');
        if (cleanPhone.length >= 7) {
          const dupPhone = members.find(m => {
            if (!m.contact_phone || m.id === editingMember?.id) return false;
            const targetClean = m.contact_phone.trim().replace(/[^0-9]/g, '');
            return targetClean.length >= 7 && targetClean === cleanPhone;
          });
          if (dupPhone) {
            setConfirmModalConfig({
              isOpen: true,
              title: "Duplicate Phone Number",
              type: "warning",
              confirmText: "Close",
              cancelText: null,
              description: (
                <p className="text-xs text-charcoal/80 text-center">
                  The phone number <strong>"{formData.contact_phone.trim()}"</strong> is already registered to <strong>"{dupPhone.first_name} {dupPhone.last_name}"</strong>.
                </p>
              ),
              onConfirm: () => setConfirmModalConfig(p => ({ ...p, isOpen: false }))
            });
            return;
          }
        }
      }

      if (!formData.address.trim()) {
        showToast("Please enter the main member's present address.", "error");
        return;
      }
      if (formData.civil_status === "Married" && createNewSpouseRecord) {
        if (registrationStep === "member") {
          setRegistrationStep("partner");
          return;
        }
        if (!spouseFormData.first_name.trim() || !spouseFormData.last_name.trim() || !spouseFormData.birthdate) {
          showToast("Please enter the partner's first name, last name, and birthday.", "error");
          return;
        }
        if (new Date(spouseFormData.birthdate) > new Date()) {
          showToast("Partner birthday cannot be in the future.", "error");
          return;
        }
        if (!spouseFormData.same_address_as_member && !spouseFormData.address.trim()) {
          showToast("Please enter the partner's own present address.", "error");
          return;
        }
      }
      // No records are written until both steps are complete.
      const registerHousehold = householdMode === "create_new" || householdMode === "existing";
      if ((householdMode === "existing" || registrationFamilyMembers.length > 0) && !householdRegistrationRole) {
        showToast("Choose your relationship in this household.", "error");
        return;
      }
      if (registerHousehold && householdMode === "existing" && !formData.household_id) {
        showToast("Choose an existing household.", "error");
        return;
      }
      setIsSavingMember(true);
      const jaMin = effectiveMinistries.find(m => m.name.toLowerCase().includes("junior"));
      const finalMinistryId = coordinatorMinistryId
        ? coordinatorMinistryId
        : (formData.civil_status === "Married" && jaMin
          ? jaMin.id
          : (formData.ministry_id ? Number(formData.ministry_id) : null));

      let finalHouseholdId: number | null = null;
      if (householdMode === "create_new") {
        // The server creates the household with the member and family links atomically.
        finalHouseholdId = null;
      } else if (householdMode === "existing") {
        finalHouseholdId = formData.household_id ? Number(formData.household_id) : null;
      } else {
        finalHouseholdId = null;
      }

      if (isJuniorAdult && familyLinks === undefined) {
        showToast('Wait for parent links to load, or retry if loading failed.', 'error');
        return;
      }
      const payload: any = {
        ...(isJuniorAdult ? { family_links: familyLinks } : {}),
        ...formData,
        guardian_names: registerHousehold && [...parentRoles,'husband','wife'].includes(householdRegistrationRole as any) ? formData.guardian_names || null : applicationGuardianName || null,
        guardian_phone: registerHousehold && [...parentRoles,'husband','wife'].includes(householdRegistrationRole as any) ? formData.guardian_phone || null : applicationGuardianPhone || null,
        family_details: applicationFamilyDetails || null,
        first_name: effectiveFirstName,
        last_name: effectiveLastName,
        civil_status: formData.civil_status || "Single",
        spouse_name: formData.spouse_name || null,
        spouse_id: formData.spouse_id ? Number(formData.spouse_id) : null,
        household_id: finalHouseholdId,
        ministry_id: finalMinistryId,
        is_baptized: formData.baptism_status === "baptized" || formData.is_baptized,
        baptism_status: formData.baptism_status || (formData.is_baptized ? "baptized" : "not_baptized"),
        baptism_date: formData.baptism_date || null,
        baptism_notes: formData.baptism_notes || null
      };

      if (registerHousehold) {
        payload.household_registration = {
          mode: householdMode === "create_new" ? "create" : "existing",
          name: newHouseholdName.trim() || `${effectiveLastName} Household`,
          household_id: finalHouseholdId,
          role: householdRegistrationRole || undefined,
          family_members: householdMode === "create_new" ? registrationFamilyMembers : []
        };
        if (relativeRegistration) {
          payload.household_registration.relative = { name: relativeRegistration.name, source_member_id: relativeRegistration.sourceMember.id };
        }
      }

      if (formData.civil_status === "Married" && createNewSpouseRecord && spouseFormData.first_name.trim()) {
        payload.partner_record = {
          first_name: spouseFormData.first_name.trim(),
          last_name: (spouseFormData.last_name || formData.last_name).trim(),
          birthdate: spouseFormData.birthdate || formData.birthdate || "1990-01-01",
          gender: spouseFormData.gender || (formData.gender === "Male" ? "Female" : "Male"),
          application_date: spouseFormData.application_date || formData.application_date || new Date().toISOString().split("T")[0],
          contact_phone: spouseFormData.contact_phone || null,
          contact_email: spouseFormData.contact_email || null,
          address: spouseFormData.same_address_as_member ? formData.address.trim() : spouseFormData.address.trim(),
          occupation: spouseFormData.occupation || null,
          facebook_account: spouseFormData.facebook_account || null,
          family_details: spouseFormData.family_details || formData.family_details || null,
          hobbies: spouseFormData.hobbies || null,
          invited_by: spouseFormData.same_inviter_as_member ? formData.invited_by.trim() : spouseFormData.invited_by.trim(),
          previous_church: spouseFormData.previous_church || null,
          medical_notes: spouseFormData.medical_notes || null,
          household_id: finalHouseholdId
        };
      }

      if (editingMember) {
        await api.updateMember(editingMember.id, payload);
        if (selectedMember && selectedMember.id === editingMember.id) {
          const refreshed = await api.getMember(editingMember.id);
          setSelectedMember(refreshed);
        }
      } else {
        await api.createMember(payload);
        if (payload.partner_record) {
          setConfirmModalConfig({
            isOpen: true,
            title: "Couple Registered Successfully!",
            type: "success",
            confirmText: "Awesome",
            cancelText: null,
            description: (
              <div className="text-center space-y-2 text-xs">
                <p>
                  Both <strong>{formData.first_name} {formData.last_name}</strong> and partner <strong>{payload.partner_record.first_name} {payload.partner_record.last_name}</strong> have been created in the <strong>Junior Adult Ministry</strong> and linked as spouses!
                </p>
              </div>
            ),
            onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
          });
        }
      }

      setIsAddModalOpen(false);
      setEditingMember(null);
      setSuggestedMinistryInfo(null);
      setCreateNewSpouseRecord(false);
      setRegistrationStep("member");
      if (relativeRegistration) {
        const sourceId = relativeRegistration.sourceMember.id;
        setRelativeRegistration(null);
        await loadData();
        setSelectedMember(await api.getMember(sourceId).catch(() => relativeRegistration.sourceMember));
      } else {
        loadData();
      }
    } catch (err: any) {
      setConfirmModalConfig({
        isOpen: true,
        title: editingMember ? "Update Failed" : "Create Failed",
        type: "danger",
        confirmText: "Close",
        cancelText: null,
        description: err.message || (editingMember ? "Failed to update member profile." : "Failed to create member record."),
        onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleDeleteMember = (memberToDelete?: Member) => {
    const target = memberToDelete || deleteConfirmMember;
    if (!target) return;
    setDeleteConfirmMember(null);
    setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));

    const previousSelected = selectedMember;
    deleteWithUndo({
      itemName: `${target.first_name} ${target.last_name}`,
      itemType: "Member",
      onOptimisticDelete: () => {
        setMembers((prev) => prev.filter((m) => m.id !== target.id));
        if (selectedMember && selectedMember.id === target.id) {
          setSelectedMember(null);
        }
      },
      onRestore: () => {
        setMembers((prev) => {
          if (prev.some((m) => m.id === target.id)) return prev;
          return [...prev, target];
        });
        if (previousSelected && previousSelected.id === target.id) {
          setSelectedMember(previousSelected);
        }
      },
      onCommitDelete: async () => {
        await api.deleteMember(target.id);
      }
    });
  };

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingHousehold) return;

    if (!householdForm.name.trim()) {
      setConfirmModalConfig({
        isOpen: true,
        title: "Required Field Missing",
        type: "warning",
        confirmText: "Okay",
        cancelText: null,
        description: <p className="text-xs text-center">Please enter a household name.</p>,
        onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const dupHousehold = households.find(h => h.id !== editingHousehold?.id && h.name.toLowerCase().trim() === householdForm.name.toLowerCase().trim());
    if (dupHousehold) {
      setConfirmModalConfig({
        isOpen: true,
        title: "Duplicate Household",
        type: "warning",
        confirmText: "Okay",
        cancelText: null,
        description: <p className="text-xs text-center">A household with the name "{householdForm.name}" already exists.</p>,
        onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const fName = householdForm.father_name?.trim() || "";
    const mName = householdForm.mother_name?.trim() || "";
    const gName = householdForm.guardian_name?.trim() || "";
    const findMemberId = (name: string) => {
      const norm = normalizeName(name);
      return availableFamilyMembers.find(m => normalizeName(memberName(m)) === norm)?.id || null;
    };

    const parentsList: HouseholdFamilyMember[] = [];
    if (fName) {
      parentsList.push({ name: fName, relationship: "Husband", member_id: findMemberId(fName) });
    }
    if (mName) {
      parentsList.push({ name: mName, relationship: "Wife", member_id: findMemberId(mName) });
    }
    if (gName) parentsList.push({ name: gName, relationship: "Guardian", member_id: findMemberId(gName) });
    for (const parent of parentsList) {
      const saved = editingHousehold?.family_members?.find(entry => entry.member_id === parent.member_id && parent.member_id);
      if (saved?.aliases?.length) parent.aliases = saved.aliases;
    }

    const othersList = householdFamilyDraft
      .map(({ name, relationship, member_id, aliases }) => ({
        name: name.trim(),
        relationship: relationship || "Family Member",
        member_id: member_id || null,
        ...(aliases?.length ? { aliases } : {})
      }))
      .filter(entry => Boolean(entry.name));

    const family = [...parentsList, ...othersList];
    const familyNames = family.map(entry => normalizeName(entry.name));

    if (othersList.some(entry => !entry.name || entry.name.length > 255) || new Set(familyNames).size !== familyNames.length) {
      setHouseholdFamilyError("Please ensure all family member names are valid and remove any duplicate entries.");
      return;
    }

    try {
      setIsSavingHousehold(true);
      const payload = {
        name: householdForm.name.trim(),
        address: householdForm.address || null,
        primary_contact_phone: householdForm.primary_contact_phone || null,
        father_name: fName || null,
        mother_name: mName || null,
        guardian_name: gName || null,
        family_members: family
      };
      if (editingHousehold) await api.updateHousehold(editingHousehold.id, payload);
      else await api.createHousehold(payload);
      setIsAddHouseholdModalOpen(false);
      setEditingHousehold(null);
      loadData();
    } catch (err: any) {
      setConfirmModalConfig({
        isOpen: true,
        title: "Failed to Save Household",
        type: "danger",
        confirmText: "Close",
        cancelText: null,
        description: err.message || "Please check the household details and try again.",
        onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setIsSavingHousehold(false);
    }
  };

  const handlePromoteMinistry = (member: Member, nextMinistryId: number) => {
    const nextMinistry = effectiveMinistries.find(m => m.id === nextMinistryId);
    setConfirmModalConfig({
      isOpen: true,
      title: "Promote Disciple",
      type: "promotion",
      confirmText: `Promote to ${nextMinistry?.name || "Next"} Ministry`,
      cancelText: "Cancel",
      description: (
        <div className="space-y-2 text-center">
          <p className="text-xs text-charcoal/80">
            Promote <strong>{member.first_name} {member.last_name}</strong> (Age {member.age}) from <strong>{member.ministry_name}</strong> to <strong>{nextMinistry?.name} Ministry</strong>?
          </p>
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 text-[12px] text-amber-950 font-medium">
            Once promoted, the aging-out notification will be automatically cleared.
          </div>
        </div>
      ),
      onConfirm: async () => {
        try {
          setConfirmModalConfig(prev => ({ ...prev, isLoading: true }));
          await api.updateMember(member.id, { ministry_id: nextMinistryId });
          loadData();
          if (selectedMember && selectedMember.id === member.id) {
            const updated = await api.getMember(member.id);
            setSelectedMember(updated);
          }
          setConfirmModalConfig({
            isOpen: true,
            title: "Promotion Successful!",
            type: "success",
            confirmText: "Done",
            cancelText: null,
            description: `${member.first_name} ${member.last_name} is now officially promoted to ${nextMinistry?.name || "the new"} Ministry!`,
            onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
          });
        } catch (err: any) {
          setConfirmModalConfig({
            isOpen: true,
            title: "Promotion Failed",
            type: "danger",
            confirmText: "Close",
            cancelText: null,
            description: err.message || "Failed to promote member.",
            onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
          });
        }
      }
    });
  };

  const handleOpenGreeting = (member: Member) => {
    setGreetingMember(member);
    const turning = member.turning_age || ((member.age ?? 0) + 1);
    setGreetingMessage(
      `Happy ${turning}th Birthday, ${member.first_name}!"The Lord bless you and keep you; the Lord make His face shine upon you and be gracious to you!"(Numbers 6:24-25). Praying for God's abundant peace, joy, and spiritual blessing upon your life!`
    );
    setGreetingSuccess(false);
  };

  const handleSendGreeting = async () => {
    if (!greetingMember) return;
    try {
      setSendingGreeting(true);
      await api.sendBirthdayGreeting(greetingMember.id, {
        message: greetingMessage,
        channel: "announcement"
      });
      setGreetingSuccess(true);
      setTimeout(() => {
        setGreetingMember(null);
        setGreetingSuccess(false);
      }, 1500);
    } catch (err: any) {
      setConfirmModalConfig({
        isOpen: true,
        title: "Greeting Failed",
        type: "danger",
        confirmText: "Close",
        cancelText: null,
        description: err.message || "Failed to send birthday blessing.",
        onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setSendingGreeting(false);
    }
  };



  const displayedMembers = React.useMemo(() => {
    return [...members].sort((a, b) => {
      const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
      const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members]);

  // Autocomplete suggestions for "Who Invites You in DPC?"
  const memberSuggestions = React.useMemo(() => {
    const source = allChurchMembers.length > 0 ? allChurchMembers : members;
    return [...source]
      .filter((m) => m && (m.first_name || m.last_name))
      .sort((a, b) => {
        const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
        const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      })
      .map((m) => {
        const fn = m.first_name || "";
        const ln = m.last_name || "";
        return {
          title: `${fn} ${ln}`.trim(),
          category: m.ministry_name ? `${m.ministry_name} Ministry` : "DPC Member",
          subtitle: m.contact_phone || m.contact_email || (m.age ? `${m.age} yrs old` : ""),
          aliases: [
            fn,
            ln,
            `${ln}, ${fn}`.trim(),
            fn ? `${fn[0]}. ${ln}`.trim() : ln
          ].filter(Boolean)
        };
      });
  }, [allChurchMembers, members]);

  // Autocomplete suggestions for Spouse / Partner Search
  const spouseMemberSuggestions = React.useMemo(() => {
    const source = allChurchMembers.length > 0 ? allChurchMembers : members;
    return source
      .filter((m) => m && (!editingMember || m.id !== editingMember.id) && (m.first_name || m.last_name))
      .sort((a, b) => {
        const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
        const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      })
      .map((m) => {
        const fn = m.first_name || "";
        const ln = m.last_name || "";
        return {
          title: `${fn} ${ln}`.trim(),
          category: m.ministry_name ? `${m.ministry_name} Ministry` : "DPC Member",
          subtitle: `${m.gender || "Member"} • ${m.age || 0} yrs old${m.contact_phone ? ` • ${m.contact_phone}` : ""}`,
          aliases: [
            fn,
            ln,
            `${ln}, ${fn}`.trim(),
            fn ? `${fn[0]}. ${ln}`.trim() : ln
          ].filter(Boolean)
        };
      });
  }, [allChurchMembers, members, editingMember]);

  // Find who invited the currently selected member
  const inviterMember = selectedMember?.invited_by
    ? (allChurchMembers.length > 0 ? allChurchMembers : members).find((m) => {
      const fullName = `${m.first_name} ${m.last_name}`.toLowerCase().trim();
      const target = selectedMember.invited_by!.toLowerCase().trim();
      return fullName === target || target.includes(fullName) || fullName.includes(target);
    })
    : null;

  // Find all members who were invited BY the currently selected member
  const disciplesInvitedByMember = selectedMember
    ? (allChurchMembers.length > 0 ? allChurchMembers : members).filter((m) => {
      if (!m.invited_by || m.id === selectedMember.id) return false;
      const thisFullName = `${selectedMember.first_name} ${selectedMember.last_name}`.toLowerCase().trim();
      const thisFirstLastReversed = `${selectedMember.last_name} ${selectedMember.first_name}`.toLowerCase().trim();
      const target = m.invited_by.toLowerCase().trim();
      return (
        target === thisFullName ||
        target === thisFirstLastReversed ||
        target.includes(thisFullName) ||
        thisFullName.includes(target)
      );
    }).sort((a, b) => {
      const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
      const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    })
    : [];

  // Filtered list for the "People Invited by Member" modal
  const filteredModalInvitedDisciples = useMemo(() => {
    if (!disciplesInvitedByMember || disciplesInvitedByMember.length === 0) return [];
    return disciplesInvitedByMember.filter((m) => {
      const query = invitedModalSearch.toLowerCase().trim();
      const matchesSearch =
        !query ||
        `${m.first_name || ""} ${m.last_name || ""}`.toLowerCase().includes(query) ||
        (m.contact_phone && m.contact_phone.includes(query)) ||
        (m.ministry_name && m.ministry_name.toLowerCase().includes(query)) ||
        (m.address && m.address.toLowerCase().includes(query)) ||
        (m.age && String(m.age).includes(query));

      const matchesMinistry =
        invitedModalMinistryFilter === "all" ||
        (m.ministry_name && m.ministry_name.toLowerCase() === invitedModalMinistryFilter.toLowerCase());

      return matchesSearch && matchesMinistry;
    });
  }, [disciplesInvitedByMember, invitedModalSearch, invitedModalMinistryFilter]);

  // Distinct ministries for filter pills inside the modal
  const invitedMemberMinistries = useMemo(() => {
    const minSet = new Set<string>();
    disciplesInvitedByMember.forEach((m) => {
      if (m.ministry_name) minSet.add(m.ministry_name);
    });
    return Array.from(minSet);
  }, [disciplesInvitedByMember]);

  const canEdit = user?.role_name === "Admin" || user?.role_name === "Pastor" || user?.role_name === "Coordinator" || user?.role_name === "IT Admin";
  const guideData = useGuideDataState("members", { loading, count: totalRecords, filtered: Boolean(searchQuery || filterMinistry || membershipFilter !== "all" || birthdayFilter !== "all"), retry: () => loadData() });

  if (isInitialMemberLoad) {
    return <MembersPageSkeleton />;
  }

  const handleAutoTransition = () => {
    setConfirmModalConfig({
      isOpen: true,
      title: "Confirm Ministry Transition",
      type: "promotion",
      confirmText: `Promote All (${agingOutCount}) Disciples`,
      cancelText: "Cancel",
      description: (
        <div className="space-y-2 text-center">
          <p className="text-xs text-charcoal/80 leading-relaxed">
            Are you sure you want to automatically transition all <strong>{agingOutCount} aging-out disciples</strong> to their age-appropriate ministries?
          </p>
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 text-[12px] text-amber-950 text-left space-y-1">
            <span className="font-medium block text-amber-900">Example Automatic Transition:</span>
            <p>Disciples aged 17–18 currently registered in <strong>Highschool (13–16)</strong> will be promoted to <strong>Youth Ministry (17–26 yrs)</strong>.</p>
          </div>
        </div>
      ),
      onConfirm: async () => {
        try {
          setConfirmModalConfig(prev => ({ ...prev, isLoading: true }));
          const res = await api.autoTransitionAgingOut();
          loadData();
          setConfirmModalConfig({
            isOpen: true,
            title: "Ministry Transition Successful!",
            type: "success",
            confirmText: "Awesome",
            cancelText: null,
            description: (
              <p className="text-xs text-charcoal/80 text-center">
                {res.message || `Successfully promoted ${res.count || agingOutCount} disciples to their new ministries!`}
              </p>
            ),
            onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
          });
        } catch (err: any) {
          setConfirmModalConfig({
            isOpen: true,
            title: "Transition Failed",
            type: "danger",
            confirmText: "Close",
            cancelText: null,
            description: err.message || "Failed to auto-transition disciples.",
            onConfirm: () => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))
          });
        }
      }
    });
  };

  const agingOutCount = members.filter(m => m.is_aging_out).length;
  const followUpCount = members.filter(m => m.status !== "inactive" && m.status !== "visitor" &&
    (m.attendance_health === "action_required" || (m.consecutive_absences && m.consecutive_absences >= 3))).length;

  return (
    <div className="members-page directory-design space-y-6">
      {/* Header & Controls Hero Banner */}
      <PageHeader icon={<Users />} title={<>Members & Family Directory</>}
        description={<>Individual member profiles, households, birthdays, medical alerts, and age-based ministry tracking.</>}
        meta={<>{coordinatorMinistryId ? `${coordinatorMinistryName} Scope` : "Church-wide directory"} · {totalRecords} active records</>}
        actions={<>{canEdit && (
          <div className="relative z-10 flex items-center gap-2.5 flex-wrap shrink-0">
            <Button data-guide="household-create" onClick={() => openHouseholdForm()} variant="secondary">
              <Home className="w-4 h-4 " />
              <span>New Household</span>
            </Button>
            <Button data-guide="member-import" type="button" onClick={handleOpenAddWithImport} title="Import and analyze member registration form photo or document" variant="secondary">
              <FileUp className="w-4 h-4 " />
              <span>Import Form / File</span>
            </Button>
          </div>
        )}</>} />

      {/* Aging-Out Quick Promotion Banner */}
      {agingOutCount > 0 && canEdit && (
        <div className="bg-rose-50 border border-rose-300 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-rose-600 text-white shadow-xs">
              <TrendingUp className="w-4 h-4 text-white" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-semibold text-rose-950">
                  {agingOutCount} Member(s) Ready for Ministry Promotion
                </h4>
                <span className="text-[12px] bg-rose-600 text-white font-medium px-2 py-0.2 rounded-full uppercase tracking-wider">
                  Aging Out
                </span>
              </div>
              <p className="text-[12px] text-charcoal/70 mt-0.5">
                These disciples have exceeded their current ministry's age limit (e.g. Highschool 13-16 → Youth 17-26).
              </p>
            </div>
          </div>
          <button
            onClick={handleAutoTransition}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-300" />
            <span>Auto-Promote All ({agingOutCount}) to Next Ministry</span>
          </button>
        </div>
      )}

      {/* Tabs, Search & Birthday Filter Bar */}
      <div ref={directoryToolbarRef} data-directory-toolbar className="sticky top-0 z-30 space-y-2 rounded-3xl bg-[var(--surface-2)] py-2">
        <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          {/* Tab switchers */}
          <div className="page-tabs flex items-center bg-indigo-50/60 p-1.5 rounded-2xl w-full xl:w-auto border border-indigo-100/60">
            <button data-guide="members-tab"
              onClick={() => setActiveTab("members")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${activeTab === "members" ? "bg-white text-indigo-950 shadow-xs border border-indigo-100" : "text-muted hover:text-indigo-950"
                }`}
             aria-pressed={activeTab === "members"}>
              <Users className="w-3.5 h-3.5 text-indigo-700" />
              <span>{coordinatorMinistryId ? `${coordinatorMinistryName} Disciples (${totalRecords})` : `All Members (${totalRecords})`}</span>
            </button>
            <button data-guide="households-tab"
              onClick={() => setActiveTab("households")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${activeTab === "households" ? "bg-white text-indigo-950 shadow-xs border border-indigo-100" : "text-muted hover:text-indigo-950"
                }`}
             aria-pressed={activeTab === "households"}>
              <Home className="w-3.5 h-3.5 text-amber-600" />
              <span>Households ({householdTotal})</span>
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-2">

            {canEdit && (
              <Button variant="primary"
                type="button"
                onClick={handleOpenAdd}
                data-guide="member-add"
                className="whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </Button>
            )}
          </div>
        </div>

        {/* Membership Status & Attendance Health Filter Bar */}
        <FilterPanel title="Directory filters" summary={[searchQuery, filterMinistry && ministries.find(m => String(m.id) === String(filterMinistry))?.name, activeTab === "members" && (membershipFilter === "all" ? "All members" : membershipFilter.replace(/_/g, " ")), activeTab === "members" && birthdayFilter !== "all" && birthdayFilter.replace(/_/g, " ")].filter(Boolean).join(" · ") || "All households"}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px] xl:w-56">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by name, email..."
                aria-label="Search members"
                data-guide="member-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                className="w-full bg-[var(--surface-2)] pl-10 pr-3.5 py-2 rounded-2xl text-xs border border-indigo-100 focus:outline-none focus:border-indigo focus:bg-white transition-all"
              />
            </div>

            {coordinatorMinistryId ? (
              <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 px-3.5 py-2 rounded-2xl text-xs font-medium flex items-center gap-2 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{coordinatorMinistryName} Ministry</span>
                <span className="text-[12px] text-indigo-700 font-medium">(Assigned)</span>
              </div>
            ) : (
              <select
                aria-label="Filter by ministry"
                value={filterMinistry}
                onChange={(e) => setFilterMinistry(e.target.value)}
                className="bg-[var(--surface-2)] px-3.5 py-2 rounded-2xl text-xs border border-indigo-100 focus:outline-none focus:border-indigo font-medium text-indigo-950 transition-all cursor-pointer"
              >
                <option value="">All Ministries</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {activeTab === "members" && (
          <div className="filter-panel-layout space-y-2">
            {/* Status Categories */}
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap bg-white p-2.5 rounded-2xl border border-indigo-100/90 shadow-2xs text-xs [&>*]:shrink-0">
              <span className="font-medium text-indigo-950 flex items-center gap-1.5 mr-1 text-[12px] uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
                <span>Status:</span>
              </span>
              {[
                { id: "all", label: "All Members", icon: <><UIUsers aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /></>, countText: "" },
                { id: "baptized_regular", label: "Baptized Regular", color: "text-indigo-950 bg-indigo-50 border-indigo-200" },
                { id: "unbaptized_regular", label: "Regular (Unbaptized)", color: "text-sky-950 bg-sky-50 border-sky-200" },
                { id: "guest", label: "Guests / Visitors", color: "text-amber-950 bg-amber-50 border-amber-300" },
                { id: "inactive", label: "Inactive / Absent", color: "text-slate-700 bg-slate-100 border-slate-300" },
                { id: "warning", label: "Warning (1–2 Absences)", color: "text-amber-900 bg-amber-50 border-amber-300 font-medium" },
                { id: "action_required", label: "Action Required (2–3+ Absences)", color: "text-rose-950 bg-rose-50 border-rose-300 font-medium" },
              ].map(pill => (
                <button
                  key={pill.id}
                  aria-pressed={membershipFilter === pill.id}
                  onClick={() => setMembershipFilter(pill.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${membershipFilter === pill.id
                    ? "bg-indigo-900 text-white shadow-xs border border-indigo-800 scale-[1.02]"
                    : "bg-white text-charcoal/70 hover:bg-indigo-50/60 border border-indigo-100"
                    }`}
                >
                  <span>{pill.icon}</span>
                  <span>{pill.label}</span>
                </button>
              ))}

              {membershipFilter !== "all" && (
                <button
                  onClick={() => setMembershipFilter("all")}
                  className="text-[12px] text-rose-600 font-medium hover:underline ml-auto flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Clear Status Filter
                </button>
              )}
            </div>

            {/* Birthday Celebrant Quick Filters */}
            <div data-guide="member-birthday-filter" className="flex items-center gap-2 overflow-x-auto whitespace-nowrap bg-white p-2.5 rounded-2xl border border-indigo-100/80 shadow-2xs text-xs [&>*]:shrink-0">
              <span className="font-medium text-indigo-950 flex items-center gap-1.5 mr-1 text-[12px] uppercase tracking-wider">
                <Cake className="w-3.5 h-3.5 text-rose-500" />
                <span>Milestones:</span>
              </span>
              {[
                { id: "all", label: "All Milestones", icon: <Users className="w-3.5 h-3.5 text-indigo-700" /> },
                { id: "today", label: "Birthday Today", icon: <Cake className="w-3.5 h-3.5 text-rose-500" /> },
                { id: "this_week", label: "This Week", icon: <Calendar className="w-3.5 h-3.5 text-rose-500" /> },
                { id: "this_month", label: "This Month", icon: <Cake className="w-3.5 h-3.5 text-emerald-600" /> },
              ].map(pill => (
                <button
                  key={pill.id}
                  onClick={() => setBirthdayFilter(pill.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${birthdayFilter === pill.id
                    ? "bg-amber-400 text-indigo-950 shadow-xs border border-amber-300"
                    : "bg-white text-charcoal/70 hover:bg-gray-100 border border-indigo-100"
                    }`}
                >
                  {pill.icon}
                  <span>{pill.label}</span>
                </button>
              ))}

              <select
                aria-label="Filter by birth month"
                value={birthdayFilter.startsWith("month_") ? birthdayFilter : ""}
                onChange={(e) => setBirthdayFilter(e.target.value || "all")}
                className="bg-white px-3 py-1.5 rounded-xl text-xs border border-indigo-100 font-medium text-indigo-950 focus:outline-none cursor-pointer"
              >
                <option value="">Filter by Birth Month...</option>
                {[
                  "January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"
                ].map((mName, i) => (
                  <option key={i + 1} value={`month_${i + 1}`}>
                    {mName} Birthdays
                  </option>
                ))}
              </select>

              {birthdayFilter !== "all" && (
                <button
                  onClick={() => setBirthdayFilter("all")}
                  className="text-[12px] text-rose-600 font-medium hover:underline ml-auto flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Reset Milestone
                </button>
              )}
            </div>
          </div>
          )}
        </FilterPanel>
      </div>

      {/* Main Content Area */}
      {activeTab === "members" ? (
        loading && members.length === 0 ? (
          <TableSkeleton rows={8} columns={7} />
        ) : (
          <div className="members-table-card bg-white/95 rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="members-follow-up-bar">
              <button type="button" className="members-follow-up-chip" data-count={followUpCount} aria-pressed={membershipFilter === "action_required"}
                title="Show members needing action. Count reflects the currently loaded page."
                onClick={() => setMembershipFilter("action_required")}>
                <AlertCircle size={14} aria-hidden="true" />{followUpCount} need follow-up on this page
              </button>
            </div>
            <div
              ref={memberListRef}
              role="region"
              aria-label="Member directory"
              tabIndex={0}
              className="overflow-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:-outline-offset-2"
              style={{ maxHeight: memberListMaxHeight ?? "60vh" }}
            >
              <table className="members-table w-full min-w-[1100px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-indigo-50 text-indigo-950 uppercase text-[12px] font-medium tracking-wider border-b border-indigo-100">
                  <tr>
                    <th scope="col" className="p-4">Member Name</th>
                    <th scope="col" className="p-4">Ministry</th>
                    <th scope="col" className="p-4">Age / Birthday</th>
                    <th scope="col" className="p-4">Household</th>
                    <th scope="col" className="p-4">Medical / Notes</th>
                    <th scope="col" className="p-4">Status & Health</th>
                    <th scope="col" className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50">
                  {displayedMembers.map((m) => (
                    <tr data-guide="member-details"
                      key={m.id}
                      onClick={() => setSelectedMember(m)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 text-indigo-950 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-800 text-white font-medium flex items-center justify-center text-xs shadow-2xs ring-2 ring-white shrink-0">
                          {m.first_name?.[0] || ""}{m.last_name?.[0] || ""}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-indigo-950 group-hover:text-amber-600 transition-colors flex items-center gap-1.5 flex-wrap">
                            <span>{m.first_name} {m.last_name}</span>
                            {m.civil_status === "Married" && (
                              <span
                                className="inline-flex items-center gap-1 text-[12px] bg-amber-100 text-amber-950 border border-amber-300 font-medium px-1.5 py-0.2 rounded-md shadow-2xs"
                                title={m.spouse_name ? `Married to ${m.spouse_name}` : "Married"}
                              >
                                <span><UIHeartHandshake aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /></span>
                                <span>{m.spouse_name ? `Spouse: ${m.spouse_name.split(" ")[0]}` : "Married"}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-muted">{m.contact_email || m.contact_phone || "No direct contact"}</div>
                          {m.bible_study_group_name && (
                            <div className="text-[12px] text-indigo-700 font-medium flex items-center gap-1 mt-0.5">
                              <BookOpen className="w-2.5 h-2.5 text-indigo-600" />
                              <span className="truncate max-w-[150px]">{m.bible_study_group_name}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shadow-inner ring-1 ring-white shrink-0"
                            style={{ backgroundColor: m.ministry_color || "var(--navy)" }}
                          />
                          <span className="font-medium text-indigo-950">{m.ministry_name || "Unassigned"}</span>
                          {m.is_aging_out && (
                            <span className="bg-rose-600 text-white text-[12px] font-medium px-2 py-0.5 rounded-full animate-pulse shadow-2xs">
                              Aging Out
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-medium text-indigo-950">{m.age} years old</div>
                        <div className="text-[12px] text-muted flex items-center gap-1.5 mt-0.5">
                          <span>{m.birth_month_name ? `${m.birth_month_name} ${m.birth_day}` : m.birthdate}</span>
                          {m.is_birthday_today ? (
                            <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-[12px] font-medium px-2 py-0.5 rounded-full animate-bounce shadow-2xs">
                              <Cake className="w-2.5 h-2.5 text-amber-300" />
                              <span>TODAY!</span>
                            </span>
                          ) : m.is_birthday_this_week ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 text-[12px] font-medium px-2 py-0.5 rounded-md border border-amber-300">
                              <Calendar className="w-2.5 h-2.5 text-amber-700" />
                              <span>in {m.days_until_birthday}d</span>
                            </span>
                          ) : m.is_birthday_this_month ? (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 text-[12px] font-medium px-1.5 py-0.5 rounded-md border border-rose-200">
                              <Cake className="w-2.5 h-2.5 text-rose-500" />
                              <span>This month</span>
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="p-4">
                        {m.household_name ? (
                          <div className="font-medium text-indigo-950 flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{m.household_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted">Individual</span>
                        )}
                      </td>

                      <td className="p-4">
                        {m.medical_notes ? (
                          <span className="bg-rose-50 border border-rose-200 text-rose-900 font-medium px-2.5 py-0.5 rounded-lg text-[12px] flex items-center gap-1.5 max-w-xs truncate">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>{m.medical_notes}</span>
                          </span>
                        ) : (
                          <span className="text-muted text-[12px] font-medium">None</span>
                        )}
                      </td>

                      {/* Status & Attendance Health Column */}
                      <td className="p-4">
                        <div className="space-y-1">
                          {/* Hybrid Status Badge */}
                          {m.status === "visitor" || m.membership_type === "guest" ? (
<Badge variant="warning" className="member-badge member-badge--guest">

                              <span>Guest / Visitor</span>
                            </Badge>
                          ) : m.status === "inactive" || m.membership_type === "inactive" ? (
<Badge variant="neutral" className="member-badge member-badge--inactive">

                              <span>Inactive / Absent</span>
                            </Badge>
                          ) : m.is_baptized || m.baptism_status === "baptized" || m.membership_type === "baptized_regular" ? (
<Badge variant="info" className="member-badge member-badge--baptized">

                              <span>Baptized Regular</span>
                            </Badge>
                          ) : (
<Badge variant="info" className="member-badge member-badge--regular">

                              <span>Regular (Unbaptized)</span>
                            </Badge>
                          )}

                          {/* Attendance Health / Inactivity Warning Pills */}
                          {m.status !== "inactive" && m.status !== "visitor" && (
                            m.attendance_health === "action_required" || (m.consecutive_absences && m.consecutive_absences >= 3) ? (
                              <div>
<Badge variant="danger" className="member-badge member-badge--attention" title={`Action Required: ${m.consecutive_absences ? `${m.consecutive_absences} consecutive absences` : "Absent 3+ weeks"} in Sunday Service / Bible Study`}>
                                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                                  <span>Action Required{m.consecutive_absences ? ` · ${m.consecutive_absences}` : ""}</span>
                                </Badge>
                              </div>
                            ) : m.attendance_health === "warning" || (m.consecutive_absences && m.consecutive_absences >= 1) ? (
                              <div>
<Badge variant="warning" className="member-badge member-badge--attention" title={`Warning: ${m.consecutive_absences ? `${m.consecutive_absences} recent absences` : "Missed service"} in Sunday Service / Bible Study`}>
                                  <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                                  <span>Warning{m.consecutive_absences ? ` · ${m.consecutive_absences}` : ""}</span>
                                </Badge>
                              </div>
                            ) : null
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <MemberRowActions name={memberName(m)} canEdit={canEdit}
                          onDetails={() => setSelectedMember(m)} onEdit={() => handleOpenEdit(m)}
                          onOverview={() => { setAttendanceSummaryInitialTab("overview"); setAttendanceSummaryMember(m); }}
                          onMilestones={() => { setAttendanceSummaryInitialTab("milestones"); setAttendanceSummaryMember(m); }}
                          onGreeting={() => handleOpenGreeting(m)} onDelete={() => setDeleteConfirmMember(m)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modern Pagination Bar */}
            <div ref={memberPaginationRef} className="p-4 bg-white border-t border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 text-charcoal/70 flex-wrap">
                <span>
                  Showing <strong className="text-indigo-950 font-medium">{totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to <strong className="text-indigo-950 font-medium">{Math.min(currentPage * pageSize, totalRecords)}</strong> of <strong className="text-indigo-950 font-medium">{totalRecords}</strong> members
                </span>
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-[12px] text-muted">Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value, 10);
                      setPageSize(newSize);
                      setCurrentPage(1);
                    }}
                    className="bg-slate-50 border border-indigo-100 rounded-lg px-2 py-1 text-xs font-medium text-indigo-950 focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1 || loading}
                    title="First Page"
                    aria-label="First Page"
                    className="p-1.5 rounded-xl border border-indigo-100 text-muted hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    title="Previous Page"
                    aria-label="Previous Page"
                    className="p-1.5 rounded-xl border border-indigo-100 text-muted hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Dynamic page numbers */}
                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                      .map((pageNumber, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showEllipsis = prev && pageNumber - prev > 1;

                        return (
                          <React.Fragment key={pageNumber}>
                            {showEllipsis && <span className="px-1 text-muted font-medium">...</span>}
                            <button
                              type="button"
                              onClick={() => handlePageChange(pageNumber)}
                              className={`w-8 h-8 rounded-xl font-medium text-xs transition-all cursor-pointer ${currentPage === pageNumber
                                ? "bg-amber-400 text-indigo-950 shadow-xs border border-amber-300 scale-105"
                                : "bg-white text-charcoal/70 hover:bg-indigo-50/70 border border-indigo-100"
                                }`}
                            >
                              {pageNumber}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    title="Next Page"
                    aria-label="Next Page"
                    className="p-1.5 rounded-xl border border-indigo-100 text-muted hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages || loading}
                    title="Last Page"
                    aria-label="Last Page"
                    className="p-1.5 rounded-xl border border-indigo-100 text-muted hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        /* Households Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {householdRows.map((h) => (
            <div key={h.id} className="bg-white/95 rounded-2xl p-6 border border-stone-200 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-indigo-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
                      <Home className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-indigo-950">{h.name}</h3>
                      <p className="text-[12px] text-muted">{h.address || "Address unlisted"}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium bg-indigo-50 text-indigo-950 px-3 py-1 rounded-full border border-indigo-100">
                    {householdFamily(h).entries.length} Family Members
                  </span>
                </div>

                {h.primary_contact_phone && (
                  <div className="text-xs text-charcoal/70 flex items-center gap-1.5 my-2.5 bg-[var(--surface-2)] p-2.5 rounded-xl border border-indigo-50">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-mono text-[12px] font-medium text-indigo-950">{h.primary_contact_phone}</span>
                  </div>
                )}

                {/* Family Members list */}
                <div className="mt-3.5 space-y-2">
                  <p className="text-[12px] font-medium uppercase tracking-wider text-muted">Household members & ministries</p>
                  {householdFamily(h).entries.map((entry) => (
                    <div key={entry.member?.id || entry.name} className="flex items-center justify-between gap-2 text-xs p-2.5 rounded-xl bg-[var(--surface-2)] border border-indigo-50/80">
                      <div className="min-w-0">
                        <span className="font-medium text-indigo-950">{entry.name}</span>
                        {entry.member?.age != null && <span className="ml-2 text-[12px] text-muted font-medium">({entry.member.age} yrs)</span>}
                        {entry.relationship !== "Family Member" && <span className="block text-[12px] text-indigo-700">{entry.relationship}</span>}
                      </div>
                      {entry.member?.ministry_name && <span className="shrink-0 text-[12px] font-medium text-indigo-950 bg-white border border-indigo-100 px-2 py-0.5 rounded-md shadow-2xs">{entry.member.ministry_name}</span>}
                    </div>
                  ))}
                  {!h.father_name && !h.mother_name && <p className="text-[12px] text-muted">Add household heads and record each person's role.</p>}
                  <button data-guide="household-edit" type="button" onClick={() => openHouseholdForm(h)} className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:underline cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" /> Edit household & family
                  </button>
                  <Button size="sm" onClick={()=>setTreeHousehold(h)}><GitBranch aria-hidden="true" className="w-4 h-4"/>View Family Tree</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "households" && <Pagination label="households" page={householdPage.page} pageSize={householdPage.pageSize} total={householdTotal} onPageChange={householdPage.setPage} onPageSizeChange={householdPage.setPageSize} loading={householdLoading} />}

      {/* Member Details Centered Modal */}
      {treeHousehold && <FamilyTreeModal household={treeHousehold} households={households} members={allChurchMembers.length?allChurchMembers:members} onClose={()=>setTreeHousehold(null)}/>}
      {selectedMember && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="directory-design w-full max-w-2xl lg:max-w-3xl bg-white rounded-3xl shadow-2xl p-6 sm:p-8 overflow-y-auto max-h-[90vh] space-y-5 border border-indigo-100 animate-in fade-in zoom-in duration-200">
            <div data-modal-header className="flex items-center justify-between pb-4 border-b border-indigo-50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-900 text-white font-medium text-xl flex items-center justify-center shadow-md ring-4 ring-indigo-50 shrink-0">
                  {selectedMember.first_name?.[0] || ""}{selectedMember.last_name?.[0] || ""}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold text-indigo-950">{selectedMember.first_name} {selectedMember.last_name}</h2>
                    {selectedMember.status === "visitor" || selectedMember.membership_type === "guest" ? (
<Badge variant="warning" className="member-badge member-badge--guest">
                        Guest / Visitor
                      </Badge>
                    ) : selectedMember.status === "inactive" || selectedMember.membership_type === "inactive" ? (
<Badge variant="neutral" className="member-badge member-badge--inactive">
                        Inactive / Absent
                      </Badge>
                    ) : selectedMember.is_baptized || selectedMember.baptism_status === "baptized" || selectedMember.membership_type === "baptized_regular" ? (
<Badge variant="info" className="member-badge member-badge--baptized">
                        Baptized Regular Member
                      </Badge>
                    ) : (
<Badge variant="info" className="member-badge member-badge--regular">
                        Regular Member (Unbaptized)
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full shadow-inner ring-1 ring-white"
                      style={{ backgroundColor: selectedMember.ministry_color || "var(--navy)" }}
                    />
                    <span className="text-xs font-medium text-charcoal/70">
                      {selectedMember.ministry_name || "Unassigned Ministry"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="p-2 rounded-xl hover:bg-gray-100 text-muted hover:text-indigo-950 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aging Out Promo Alert Banner if applicable */}
            {selectedMember.is_aging_out && (
              <div className="bg-rose-50/70 border border-rose-300 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 font-medium text-rose-950">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Member is Aging Out of Current Ministry</span>
                </div>
                <p className="text-charcoal/80 leading-relaxed">
                  At {selectedMember.age} years old, {selectedMember.first_name} has completed the {selectedMember.ministry_name} age bracket and is eligible for promotion.
                </p>
                <div className="mt-2 flex flex-wrap gap-2 pt-1">
                  {effectiveMinistries
                    .filter(m => (m.min_age ?? 0) <= (selectedMember.age ?? 0) && (m.max_age ?? 999) >= (selectedMember.age ?? 0) && m.id !== selectedMember.ministry_id)
                    .map(nextM => (
                      <button
                        key={nextM.id}
                        onClick={() => handlePromoteMinistry(selectedMember, nextM.id)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-3.5 py-1.5 rounded-xl text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <TrendingUp className="w-3.5 h-3.5 text-white" />
                        <span>Promote to {nextM.name} Ministry</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Telemetry Card: Membership Classification & Attendance Health */}
            <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-200/90 shadow-2xs space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-100/80">
                <div className="flex items-center gap-2 font-medium text-indigo-950 text-xs">
                  <ShieldCheck className="w-4 h-4 text-indigo-700" />
                  <span>Membership Classification & Attendance Health</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedMember;
                    setSelectedMember(null);
                    setAttendanceSummaryInitialTab("overview");
                    setAttendanceSummaryMember(target);
                  }}
                  className="text-[12px] font-medium text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Calendar className="w-3 h-3 text-indigo-600" />
                  <span>Full Attendance Tracker</span>
                </button>
              </div>

              {/* Attendance Health Alert Banner */}
              {selectedMember.status === "inactive" || selectedMember.membership_type === "inactive" ? (
                <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl flex items-start gap-2.5 text-slate-800">
                  <AlertCircle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-medium text-xs text-slate-900">Inactive / Absent Record</strong>
                    <span className="text-[12px]">This member is currently tagged as Inactive. Pastoral follow-up or visitation recommended.</span>
                  </div>
                </div>
              ) : selectedMember.attendance_health === "action_required" || (selectedMember.consecutive_absences && selectedMember.consecutive_absences >= 3) ? (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2.5 text-rose-950">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <strong className="block font-medium text-xs text-rose-900"><UICircleX aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Action Required: 2–3+ Consecutive Absences</strong>
                    <span className="text-[12px]">Member has missed {selectedMember.consecutive_absences || "3+"} consecutive services and small group sessions. Immediate pastoral follow-up or contact is recommended!</span>
                  </div>
                </div>
              ) : selectedMember.attendance_health === "warning" || (selectedMember.consecutive_absences && selectedMember.consecutive_absences >= 1) ? (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-medium text-xs text-amber-900"><UIClock aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Warning: Recent Service Absence</strong>
                    <span className="text-[12px]">Member missed {selectedMember.consecutive_absences || "a recent"} Sunday service / small group session. An encouragement or check-in message is suggested.</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-medium text-xs text-emerald-900"><UICircleCheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Healthy & Active Attendee</strong>
                    <span className="text-[12px]">Regular active participant in Sunday Divine Services and fellowship activities.</span>
                  </div>
                </div>
              )}

              {/* Telemetry Metric Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="text-[12px] text-muted block font-medium">Baptism</span>
                  <div className="font-medium text-xs text-indigo-950 flex items-center gap-1 mt-0.5">
                    {selectedMember.is_baptized || selectedMember.baptism_status === "baptized" ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <span><UIChurch aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Baptized</span>
                        {selectedMember.baptism_date && <span className="text-[12px] text-muted">({selectedMember.baptism_date})</span>}
                      </span>
                    ) : selectedMember.baptism_status === "candidate" || selectedMember.baptism_status === "scheduled" ? (
                      <span className="text-cyan-700 flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-cyan-600" />
                        <span>Candidate</span>
                      </span>
                    ) : (
                      <span className="text-muted">Not Baptized</span>
                    )}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="text-[12px] text-muted block font-medium">Last Present Attendance</span>
                  <span className="font-medium text-xs text-indigo-950 mt-0.5 block">
                    {selectedMember.last_attended_date ? selectedMember.last_attended_date : "No check-in record"}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="text-[12px] text-muted block font-medium">Bible Study Small Group</span>
                  <span className="font-medium text-xs text-indigo-950 mt-0.5 block truncate">
                    {selectedMember.bible_study_group_name ? selectedMember.bible_study_group_name : "Not enrolled"}
                  </span>
                  {selectedMember.bible_study_leader_name && (
                    <span className="text-[12px] text-indigo-700 font-medium block">Leader: {selectedMember.bible_study_leader_name}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Card 1: Member Demographics */}
              <div className="p-4 bg-[var(--surface-2)] rounded-2xl border border-indigo-100/70 space-y-2">
                <p className="font-medium text-indigo-950 text-[12px] uppercase tracking-wider">Personal Details</p>
                <div className="flex justify-between">
                  <span className="text-muted">Age:</span>
                  <span className="font-medium text-indigo-950">{selectedMember.age} years old</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Birthdate:</span>
                  <span className="font-medium text-charcoal">{selectedMember.birthdate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Gender:</span>
                  <span className="font-medium text-charcoal">{selectedMember.gender || "Unspecified"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Civil Status:</span>
                  <span className="font-medium text-indigo-950">
                    {selectedMember.civil_status === "Married" ? <><UIHeartHandshake aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Married</> : (selectedMember.civil_status || "Single")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Grade Level:</span>
                  <span className="font-medium text-charcoal">{selectedMember.grade_level || "N/A"}</span>
                </div>
              </div>

              {/* Card 2: Household & Ministry */}
              <div className="p-4 bg-[var(--surface-2)] rounded-2xl border border-indigo-100/70 space-y-2">
                <p className="font-medium text-indigo-950 text-[12px] uppercase tracking-wider">Household & Ministry</p>
                <div className="flex justify-between">
                  <span className="text-muted">Household:</span>
                  <span className="font-medium text-indigo-950">{selectedMember.household_name || "Individual"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Current Ministry:</span>
                  <span className="font-medium text-indigo-950">{selectedMember.ministry_name || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Email:</span>
                  <span className="font-medium text-charcoal truncate max-w-[140px]">{selectedMember.contact_email || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Phone:</span>
                  <span className="font-medium text-charcoal">{selectedMember.contact_phone || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Dedicated Marriage & Spouse Card */}
            {(selectedMember.civil_status === "Married" || selectedMember.spouse_name || selectedMember.spouse_id) && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300/80 shadow-2xs space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                  <span className="font-medium text-amber-950 flex items-center gap-1.5 text-xs">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-100" />
                    <span>Spouse & Marriage Information</span>
                  </span>
                  <span className="text-[12px] bg-amber-500 text-white font-medium px-2.5 py-0.5 rounded-full shadow-2xs"><UIHeartHandshake aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Married • Junior Adult Scope
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 bg-white/90 p-3 rounded-xl border border-amber-200 shadow-2xs flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-amber-600 text-white font-medium text-xs flex items-center justify-center shrink-0 shadow-2xs"><UIHeartHandshake aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" />
                    </div>
                    <div>
                      <span className="text-[12px] text-muted block font-medium">Married To (Spouse)</span>
                      <h4 className="font-semibold text-xs text-indigo-950">
                        {selectedMember.spouse_name || (selectedMember.linked_spouse_first_name ? `${selectedMember.linked_spouse_first_name} ${selectedMember.linked_spouse_last_name}` : "Registered Spouse")}
                      </h4>
                      {selectedMember.linked_spouse_ministry_name && (
                        <span className="text-[12px] text-indigo-700 font-medium">
                          {selectedMember.linked_spouse_ministry_name} Ministry
                        </span>
                      )}
                    </div>
                  </div>

                  {(() => {
                    const spouseObj = selectedMember.spouse_id
                      ? members.find(m => m.id === selectedMember.spouse_id)
                      : (selectedMember.spouse_name ? members.find(m => `${m.first_name} ${m.last_name}`.toLowerCase() === selectedMember.spouse_name?.toLowerCase()) : null);

                    if (spouseObj) {
                      return (
                        <button
                          type="button"
                          onClick={() => setSelectedMember(spouseObj)}
                          className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-medium text-[12px] transition-all flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
                        >
                          <span>View Spouse Profile</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}

            {/* Card 3: Birthday & Milestone Celebration */}
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-indigo-950 flex items-center gap-1.5 text-xs">
                  <Cake className="w-4 h-4 text-rose-500" />
                  <span>Birthday & Milestone Celebration</span>
                </span>
                {selectedMember.is_birthday_today ? (
                  <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-[12px] font-medium px-2.5 py-0.5 rounded-full animate-bounce shadow-2xs">
                    <Cake className="w-3 h-3 text-amber-300" />
                    <span>TODAY!</span>
                  </span>
                ) : selectedMember.is_birthday_this_week ? (
                  <span className="inline-flex items-center gap-1 bg-amber-400 text-indigo-950 text-[12px] font-medium px-2.5 py-0.5 rounded-full shadow-2xs">
                    <Calendar className="w-3 h-3 text-indigo-900" />
                    <span>In {selectedMember.days_until_birthday} days!</span>
                  </span>
                ) : selectedMember.is_birthday_this_month ? (
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 text-[12px] font-medium px-2.5 py-0.5 rounded-full border border-amber-300">
                    <Cake className="w-3 h-3 text-amber-700" />
                    <span>This Month</span>
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100 shadow-2xs">
                  <span className="text-[12px] text-muted block font-medium">Birth Date</span>
                  <span className="font-medium text-indigo-950">
                    {selectedMember.birth_month_name ? `${selectedMember.birth_month_name} ${selectedMember.birth_day}` : selectedMember.birthdate}
                  </span>
                </div>
                <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100 shadow-2xs">
                  <span className="text-[12px] text-muted block font-medium">Next Turning Age</span>
                  <span className="font-medium text-indigo-950">
                    {selectedMember.turning_age || ((selectedMember.age ?? 0) + 1)} yrs old
                  </span>
                </div>
                <div className="bg-white/90 p-2.5 rounded-xl border border-amber-100 shadow-2xs">
                  <span className="text-[12px] text-muted block font-medium">Countdown</span>
                  <span className="font-medium text-amber-700 flex items-center gap-1">
                    {selectedMember.days_until_birthday !== undefined ? (
                      selectedMember.days_until_birthday === 0 ? (
                        <>
                          <Cake className="w-3 h-3 text-amber-600" />
                          <span>Today!</span>
                        </>
                      ) : `${selectedMember.days_until_birthday} days`
                    ) : "Upcoming"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenGreeting(selectedMember)}
                className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-indigo-950 font-medium text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Gift className="w-4 h-4 text-indigo-950" />
                <span>Send Birthday Blessing / Announcement</span>
              </button>
            </div>

            {/* Card: Annual Attendance & Water Baptism Ceremony Tracker */}
            <div className="p-4 bg-cyan-50 rounded-2xl border border-cyan-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-cyan-100 text-cyan-800">
                    <Droplets className="w-4 h-4 text-cyan-600 fill-cyan-300" />
                  </div>
                  <div>
                    <span className="font-medium text-indigo-950 text-xs block">
                      Annual Attendance & Baptism Ceremony
                    </span>
                    <span className="text-[12px] text-muted">
                      Sunday service attendance consistency and baptism ceremony milestone
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedMember;
                      setSelectedMember(null);
                      setAttendanceSummaryInitialTab("overview");
                      setAttendanceSummaryMember(target);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-800  text-white font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>Attendance Rates & Streaks</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedMember;
                      setSelectedMember(null);
                      setAttendanceSummaryInitialTab("monthly");
                      setAttendanceSummaryMember(target);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-700  text-white font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                  >
                    <Calendar className="w-3.5 h-3.5 text-cyan-200" />
                    <span>Open Full-Year Attendance</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white/90 p-2.5 rounded-xl border border-cyan-100 shadow-2xs">
                  <span className="text-[12px] text-muted block font-medium">Baptism Status</span>
                  <span className="font-medium text-indigo-950 flex items-center gap-1">
                    {selectedMember.baptism_status === "candidate" || selectedMember.baptism_status === "scheduled" ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                        <span className="text-cyan-700"><UIWaves aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Ceremony Candidate</span>
                      </>
                    ) : selectedMember.is_baptized || selectedMember.baptism_status === "baptized" ? (
                      <>
                        <span><UIChurch aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /></span>
                        <span className="text-emerald-700">Baptized</span>
                      </>
                    ) : (
                      <span className="text-muted"><UICircle aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Not Yet Baptized</span>
                    )}
                  </span>
                </div>

                <div className="bg-white/90 p-2.5 rounded-xl border border-cyan-100 shadow-2xs">
                  <span className="text-[12px] text-muted block font-medium">Ceremony Date</span>
                  <span className="font-medium text-indigo-950">
                    {selectedMember.baptism_date || "Not set / scheduled"}
                  </span>
                </div>

                <div className="bg-white/90 p-2.5 rounded-xl border border-cyan-100 shadow-2xs">
                  <span className="text-[12px] text-muted block font-medium">Readiness / Alert</span>
                  <span className="font-medium text-indigo-950 flex items-center gap-1">
                    {selectedMember.baptism_status === "candidate" || selectedMember.baptism_status === "scheduled" ? (
                      <span className="text-cyan-800 font-medium"><UIBell aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Alert Triggered</span>
                    ) : selectedMember.is_baptized ? (
                      <span className="text-emerald-700 font-medium"><UICircleCheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Completed</span>
                    ) : (
                      <span className="text-amber-800 font-medium">Pending Evaluation</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Official Application Card Details */}
            {(selectedMember.address || selectedGuardian || selectedMember.school_name || selectedMember.program_major || selectedMember.occupation || selectedMember.hobbies || selectedMember.invited_by || selectedMember.previous_church || selectedMember.facebook_account || selectedFamilyDetails || selectedMember.class_schedule || selectedMember.application_date) && (
              <div className="p-4 bg-white rounded-2xl border border-indigo-100 shadow-2xs space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-indigo-50">
                  <span className="font-medium text-indigo-950 flex items-center gap-1.5 text-xs">
                    <FileText className="w-4 h-4 text-indigo-700" />
                    <span>Application for Membership Card</span>
                  </span>
                  {selectedMember.application_date && (
                    <span className="text-[12px] bg-indigo-50 text-indigo-950 px-2.5 py-0.5 rounded-md font-medium border border-indigo-100">
                      Applied: {selectedMember.application_date}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {selectedMember.address && (
                    <div className="sm:col-span-2 flex items-start gap-2 bg-[var(--surface-2)] p-2.5 rounded-xl border border-indigo-50">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[12px] text-muted block font-medium">Address</span>
                        <span className="text-indigo-950 font-medium">{selectedMember.address}</span>
                      </div>
                    </div>
                  )}

                  {/* Structured Family Members & Household */}
                  {selectedFamily.entries.length > 0 ? (
                    <MemberFamilySection member={selectedMember} household={selectedHousehold} canEdit={canEdit}
                      onViewMember={setSelectedMember} onRegister={setRelativeChoice} />
                  ) : (selectedGuardian || selectedMember.guardian_phone) ? (
                    <div className="bg-[var(--surface-2)] p-2.5 rounded-xl border border-indigo-50">
                      <span className="text-[12px] text-muted block font-medium">Parents / Emergency Contact</span>
                      <span className="text-indigo-950 font-medium">{selectedGuardian || "Unlisted"}</span>
                      {selectedGuardianPhone && (
                        <span className="text-indigo-700 block text-[12px] font-medium">{selectedGuardianPhone}</span>
                      )}
                    </div>
                  ) : null}

                  {selectedMember.school_name && (
                    <div className="bg-[var(--surface-2)] p-2.5 rounded-xl border border-indigo-50">
                      <span className="text-[12px] text-muted block font-medium">
                        {selectedMember.occupation ? "School / College Graduated" : "School / College"}
                      </span>
                      <span className="text-indigo-950 font-medium">{selectedMember.school_name}</span>
                      {selectedMember.program_major && (
                        <span className="text-indigo-700 block text-[12px] font-medium">{selectedMember.program_major}</span>
                      )}
                    </div>
                  )}

                  {selectedMember.occupation && (
                    <div className="bg-[var(--surface-2)] p-2.5 rounded-xl border border-indigo-50">
                      <span className="text-[12px] text-muted block font-medium">Occupation / Workplace</span>
                      <span className="text-indigo-950 font-medium">{selectedMember.occupation}</span>
                    </div>
                  )}

                  {selectedMember.class_schedule && (
                    <div className="bg-[var(--surface-2)] p-2.5 rounded-xl border border-indigo-50">
                      <span className="text-[12px] text-muted block font-medium">
                        {selectedMember.occupation ? "Work / Availability Schedule" : "Class Schedule"}
                      </span>
                      <span className="text-indigo-950 font-medium">{selectedMember.class_schedule}</span>
                    </div>
                  )}

                  {selectedMember.hobbies && (
                    <div className="bg-[var(--surface-2)] p-2.5 rounded-xl border border-indigo-50">
                      <span className="text-[12px] text-muted block font-medium">Hobbies</span>
                      <span className="text-indigo-950 font-medium">{selectedMember.hobbies}</span>
                    </div>
                  )}

                  {selectedMember.invited_by && (
                    <div className="bg-[var(--surface-2)] p-2.5 rounded-xl border border-indigo-50">
                      <span className="text-[12px] text-muted block font-medium">Who Invited in DPC?</span>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-indigo-950 font-medium">{selectedMember.invited_by}</span>
                        {inviterMember && (
                          <button
                            type="button"
                            onClick={() => setSelectedMember(inviterMember)}
                            className="text-[12px] text-indigo-600 hover:text-indigo-800 font-medium underline cursor-pointer flex items-center gap-0.5"
                          >
                            <span>View Inviter</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedMember.previous_church && (
                    <div className="bg-[var(--surface-2)] p-2.5 rounded-xl border border-indigo-50">
                      <span className="text-[12px] text-muted block font-medium">Previous Church</span>
                      <span className="text-indigo-950 font-medium">{selectedMember.previous_church}</span>
                    </div>
                  )}

                  {selectedMember.facebook_account && (
                    <div className="bg-[var(--surface-2)] p-2.5 rounded-xl border border-indigo-50">
                      <span className="text-[12px] text-muted block font-medium">Facebook Account</span>
                      <span className="text-indigo-950 font-medium">{selectedMember.facebook_account}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Outreach & Discipleship Tree: People Invited by this Member */}
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-50 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700">
                    <Users className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-xs text-indigo-950">
                      Discipleship & Outreach: People Invited by {selectedMember.first_name}
                    </h3>
                    <p className="text-[12px] text-muted">
                      Members and attendees brought into DPC through {selectedMember.first_name}'s invitation
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium bg-indigo text-white px-3 py-1 rounded-full shadow-2xs">
                    {disciplesInvitedByMember.length} {disciplesInvitedByMember.length === 1 ? "Invited Person" : "Invited People"}
                  </span>
                  {disciplesInvitedByMember.length > 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        setInvitedModalSearch("");
                        setInvitedModalMinistryFilter("all");
                        setIsInvitedMembersModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-white hover:bg-indigo-100 text-indigo-700 hover:text-indigo-950 font-medium text-[12px] border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                    >
                      <span>See More ({disciplesInvitedByMember.length})</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {disciplesInvitedByMember.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {disciplesInvitedByMember.slice(0, 4).map((invited) => (
                      <div
                        key={invited.id}
                        onClick={() => setSelectedMember(invited)}
                        className="p-3 bg-white rounded-xl border border-indigo-100/90 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-800 text-white text-xs font-medium flex items-center justify-center shrink-0 shadow-2xs">
                            {invited.first_name?.[0] || ""}{invited.last_name?.[0] || ""}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-xs text-indigo-950 truncate group-hover:text-amber-600 transition-colors">
                              {invited.first_name} {invited.last_name}
                            </div>
                            <div className="text-[12px] text-muted flex items-center gap-1.5 mt-0.5">
                              <span className="font-medium text-indigo-800">{invited.ministry_name || "Member"}</span>
                              <span>•</span>
                              <span>{invited.age} yrs old</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="text-[12px] font-medium text-indigo-600 group-hover:text-indigo-900 group-hover:translate-x-0.5 transition-all flex items-center gap-1 shrink-0 ml-2"
                        >
                          <span>Profile</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {disciplesInvitedByMember.length > 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        setInvitedModalSearch("");
                        setInvitedModalMinistryFilter("all");
                        setIsInvitedMembersModalOpen(true);
                      }}
                      className="w-full p-2.5 bg-white hover:bg-indigo-100/80 text-indigo-900 font-medium text-xs rounded-xl border border-indigo-200/90 hover:border-indigo-300 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs group"
                    >
                      <span>+ View {disciplesInvitedByMember.length - 4} more invited {disciplesInvitedByMember.length - 4 === 1 ? "person" : "people"} (Open Full List)</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-600 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3.5 bg-[var(--surface-2)] rounded-xl border border-dashed border-indigo-200/80 text-center text-muted text-xs">
                  <p className="font-medium text-[12px]">
                    No members or visitors currently registered under {selectedMember.first_name}'s invitation.
                  </p>
                </div>
              )}
            </div>

            {/* Medical / Allergy Alert Box */}
            {selectedMember.medical_notes && (
              <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl text-xs space-y-1.5">
                <span className="font-medium text-rose-950 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Medical & Special Care Instructions:</span>
                </span>
                <p className="text-rose-950 font-medium bg-white p-3 rounded-xl border border-rose-100 shadow-2xs">
                  {selectedMember.medical_notes}
                </p>
              </div>
            )}

            {/* Modal Footer */}
            <div data-modal-footer className="pt-3 border-t border-indigo-50 flex items-center justify-between gap-2 flex-wrap">
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmMember(selectedMember)}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium rounded-2xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Delete Record</span>
                  </button>
                  <button data-guide="member-edit"
                    type="button"
                    onClick={() => handleOpenEdit(selectedMember)}
                    className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 font-medium rounded-2xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Pencil className="w-4 h-4 text-indigo-600" />
                    <span>Edit Record</span>
                  </button>
                </div>
              ) : <div />}

              <button
                onClick={() => {
                  setSelectedMember(null);
                  setIsInvitedMembersModalOpen(false);
                }}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-charcoal font-medium rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* Discipleship & Outreach Full Modal: People Invited by Member */}
      {isInvitedMembersModalOpen && selectedMember && createPortal(
        <div className="fixed inset-0 z-[120] bg-charcoal/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div data-modal-panel className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-indigo-100 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Modal Header */}
            <div data-modal-header className="p-5 sm:p-6 bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white border-b border-indigo-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/10 text-amber-300 border border-white/15 shadow-inner">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold text-white">
                      People Invited by {selectedMember.first_name} {selectedMember.last_name}
                    </h2>
                    <span className="text-xs bg-amber-400 text-indigo-950 font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
                      {disciplesInvitedByMember.length} Total
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Full discipleship & outreach tree of members brought to DPC through their personal invitation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInvitedMembersModalOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Ministry Filters Bar */}
            <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search invited member by name, phone, age, ministry..."
                  value={invitedModalSearch}
                  onChange={(e) => setInvitedModalSearch(e.target.value)}
                  className="w-full bg-white pl-9 pr-8 py-2.5 rounded-xl border border-indigo-200 text-xs font-medium text-charcoal shadow-2xs placeholder:text-muted focus:outline-none focus:border-indigo"
                />
                {invitedModalSearch && (
                  <button
                    type="button"
                    onClick={() => setInvitedModalSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-charcoal cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Ministry Filter Pills if there are multiple ministries */}
              {invitedMemberMinistries.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 text-xs">
                  <span className="text-[12px] text-muted font-medium shrink-0 flex items-center gap-1 mr-1">
                    <Filter className="w-3 h-3 text-indigo-600" />
                    <span>Filter:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setInvitedModalMinistryFilter("all")}
                    className={`px-3 py-1 rounded-xl text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap border ${invitedModalMinistryFilter === "all"
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                        : "bg-white text-charcoal/80 border-gray-200 hover:bg-indigo-50 hover:border-indigo-200"
                      }`}
                  >
                    All ({disciplesInvitedByMember.length})
                  </button>
                  {invitedMemberMinistries.map((minName) => {
                    const count = disciplesInvitedByMember.filter(
                      (m) => m.ministry_name?.toLowerCase() === minName.toLowerCase()
                    ).length;
                    return (
                      <button
                        key={minName}
                        type="button"
                        onClick={() => setInvitedModalMinistryFilter(minName)}
                        className={`px-3 py-1 rounded-xl text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap border ${invitedModalMinistryFilter.toLowerCase() === minName.toLowerCase()
                            ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                            : "bg-white text-charcoal/80 border-gray-200 hover:bg-indigo-50 hover:border-indigo-200"
                          }`}
                      >
                        {minName} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Member Cards List (Scrollable) */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 max-h-[50vh] custom-scrollbar flex-1">
              {filteredModalInvitedDisciples.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredModalInvitedDisciples.map((invited) => (
                    <div
                      key={invited.id}
                      onClick={() => {
                        setSelectedMember(invited);
                        setIsInvitedMembersModalOpen(false);
                      }}
                      className="p-3 bg-white rounded-2xl border border-indigo-100 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group bg-gradient-to-br hover:from-indigo-50/40 hover:to-white"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-indigo-800 text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                          {invited.first_name?.[0] || ""}{invited.last_name?.[0] || ""}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-indigo-950 truncate group-hover:text-amber-600 transition-colors">
                            {invited.first_name} {invited.last_name}
                          </div>
                          <div className="text-[12px] text-muted flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-medium text-indigo-800 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                              {invited.ministry_name || "Member"}
                            </span>
                            <span>•</span>
                            <span>{invited.age} yrs old</span>
                            {invited.gender && (
                              <>
                                <span>•</span>
                                <span>{invited.gender}</span>
                              </>
                            )}
                          </div>
                          {invited.contact_phone && (
                            <div className="text-[12px] text-muted flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span>{invited.contact_phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-700 font-medium text-[12px] transition-all flex items-center gap-1 shrink-0 ml-2 shadow-2xs"
                      >
                        <span>Profile</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted space-y-2 bg-[var(--surface-2)] rounded-2xl border border-dashed border-indigo-200">
                  <Users className="w-8 h-8 text-indigo-300 mx-auto" />
                  <p className="font-medium text-xs text-charcoal">
                    No invited members match your current filter
                  </p>
                  {invitedModalSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setInvitedModalSearch("");
                        setInvitedModalMinistryFilter("all");
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium cursor-pointer"
                    >
                      Reset Search Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div data-modal-footer className="p-4 bg-gray-50 border-t border-indigo-100 flex items-center justify-between gap-3 text-xs shrink-0">
              <span className="text-muted font-medium text-[12px]">
                Showing <strong>{filteredModalInvitedDisciples.length}</strong> of <strong>{disciplesInvitedByMember.length}</strong> invited members
              </span>
              <button
                type="button"
                onClick={() => setIsInvitedMembersModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-charcoal font-medium text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Delete Member Confirmation Modal */}
      {deleteConfirmMember && <MemberDeleteDialog onClose={() => setDeleteConfirmMember(null)} busy={isDeleting}
        footer={<>
          <Button variant="secondary" data-dialog-autofocus disabled={isDeleting} onClick={() => setDeleteConfirmMember(null)}>Cancel</Button>
          <Button variant="destructive" disabled={isDeleting} onClick={() => handleDeleteMember(null)}>
            {isDeleting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /><span>Deleting...</span></>
              : <><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /><span>Yes, Delete Member</span></>}
          </Button>
        </>}>
        <div className="member-delete-notice space-y-1">
          <p>Are you sure you want to delete <strong>{deleteConfirmMember.first_name} {deleteConfirmMember.last_name}</strong>?</p>
          <p>Ministry: <strong>{deleteConfirmMember.ministry_name || "Unassigned"}</strong> • Age: <strong>{deleteConfirmMember.age || "N/A"} yrs</strong></p>
        </div>
      </MemberDeleteDialog>}
      {relativeChoice && <RelativeRegistrationModal context={relativeChoice} households={households}
        onClose={() => setRelativeChoice(null)} onCreate={relationship => registerRelative(relativeChoice, relationship)}
        onLink={(member, relationship) => linkRelative(relativeChoice, member, relationship)} />}
      {isAddModalOpen && createPortal(
        (() => {
          const isKinder = currentMinName.includes("kinder");
          const isElementary = currentMinName.includes("elem");
          const isHighSchool = currentMinName.includes("high") || currentMinName.includes("school");
          const isYouth = currentMinName.includes("youth") && !currentMinName.includes("adult");
          const isYoungAdult = currentMinName.includes("young");
          const isOldAdult = currentMinName.includes("old") || currentMinName.includes("senior");
          const renderFamilyDetails = (label = "Family Members (Parents & siblings)", placeholder = "e.g. Parents, 2 siblings") => (
            <MemberFamilyDetailsField household={linkedHousehold} details={formData.family_details}
              onDetailsChange={details => setFormData(prev => ({ ...prev, family_details: details }))}
              label={label} placeholder={placeholder} />
          );

          const getMinistryRequirementSummary = (name?: string) => {
            const n = (name || "").toLowerCase();
            if (n.includes("kinder")) return "Requires Parent/Guardian Contact & Allergy Instructions";
            if (n.includes("elem")) return "Requires Invitee & Parent Guardian Information";
            if (n.includes("high") || n.includes("school")) return "Requires School, Grade Level, Hobbies & Invitee";
            if (n.includes("youth") && !n.includes("adult")) return "Supports College Students & Graduated / Working Youth (Ages 18–26)";
            if (n.includes("young")) return "Requires Workplace/Occupation, Previous Church & Invitee";
            if (n.includes("junior")) return "Requires Occupation, Facebook Handle & Invitee";
            if (n.includes("old") || n.includes("senior")) return "Requires Status, Living With & Health Maintenance";
            return "General Medical & Allergy Notes";
          };

          return (
            <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={`flex items-center justify-center gap-5 w-full ${registrationStep === "partner" ? "max-w-[1400px]" : "max-w-3xl"}`}>
                <ModalPanel data-modal-panel role={registrationStep === "member" ? "dialog" : undefined} aria-modal={registrationStep === "member" ? true : undefined} aria-label={editingMember ? "Edit Member" : "Add New Member Record"}
                  inert={registrationStep === "partner" || isSavingMember}
                  className={`directory-design bg-white rounded-3xl w-full min-w-0 p-6 sm:p-8 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto border border-indigo-100/80 ${registrationStep === "partner" ? "hidden xl:flex xl:flex-1 brightness-90" : ""}`}>
                  {createNewSpouseRecord && <p className="text-[12px] font-medium uppercase tracking-widest text-indigo-600">Step 1 of 2 · Main Member</p>}
                  <div data-modal-header className="flex items-center justify-between">
                    <h2 className="text-base sm:text-lg font-semibold text-charcoal flex items-center gap-2">
                      {editingMember ? <Pencil className="w-5 h-5 text-amber-600" /> : <Users className="w-5 h-5 text-indigo" />}
                      <span>{editingMember ? `Edit Member: ${editingMember.first_name} ${editingMember.last_name}` : "Add New Member Record"}</span>
                    </h2>
                    <button onClick={closeMemberForm} className="p-1.5 text-muted hover:bg-gray-100 rounded-xl cursor-pointer transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* DPC Physical Form Synchronized Header */}
                  <div className="bg-indigo-950 p-3.5 rounded-2xl text-white shadow-xs border border-indigo-800 flex items-center justify-between">
                    <div>
                      <span className="text-[12px] font-medium uppercase tracking-widest text-indigo-300 block">
                        Daet Presbyterian Church
                      </span>
                      <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span>Application for Membership</span>
                        {currentModalMinistry && (
                          <span className="text-white text-xs font-medium">• {currentModalMinistry.name}</span>
                        )}
                      </h3>
                    </div>
                    <span className="text-[12px] bg-white/10 text-indigo-200 px-2 py-0.5 rounded-md border border-white/20 font-medium">
                      Paper Form Sync
                    </span>
                  </div>

                  {/* Target Ministry Application Form Type Dropdown (Admin Selector / Coordinator Scope) */}
                  {relativeRegistration && <p className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950">
                    Registering <strong>{relativeRegistration.name}</strong> from <strong>{relativeRegistration.household.name}</strong>. Check the complete name, birthday, and address before saving.
                  </p>}
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="font-medium text-indigo-950 text-xs flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-700" />
                        <span>Application Form Type (Target Ministry):</span>
                      </label>
                      <span className="text-[12px] font-medium px-2 py-0.5 rounded-md bg-white text-indigo-900 border border-indigo-200 shadow-2xs">
                        {coordinatorMinistryId ? "Coordinator Scope" : (formData.ministry_id ? "Manual Ministry Selected" : "Auto-Detect by Birthday")}
                      </span>
                    </div>

                    {coordinatorMinistryId ? (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 font-medium text-xs flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Locked to <strong>{coordinatorMinistryName} Ministry Form</strong> (Coordinator Scope)</span>
                      </div>
                    ) : (
                      <select data-guide="member-ministry"
                        value={formData.ministry_id}
                        onChange={(e) => {
                          const val = e.target.value;
                          const selectedMin = effectiveMinistries.find(m => String(m.id) === String(val));
                          const minName = (selectedMin?.name || "").toLowerCase();
                          const isJA = minName.includes("junior");
                          const isOA = minName.includes("old") || minName.includes("senior");
                          setFormData(prev => ({
                            ...prev,
                            ministry_id: val,
                            civil_status: (isJA || isOA)
                              ? (prev.civil_status === "Widowed" ? "Widowed" : "Married")
                              : "Single",
                            ...((!isJA && !isOA) ? { spouse_name: "", spouse_id: "" } : {})
                          }));
                          if (isJA || isOA) {
                            if (householdMode === "none") setHouseholdMode("create_new");
                          }
                          if (!isJA && !isOA) {
                            setCreateNewSpouseRecord(false);
                            setRegistrationStep("member");
                          }
                        }}
                        className="w-full bg-white p-2.5 rounded-xl border border-indigo-200 focus:outline-none focus:border-indigo font-medium text-indigo-950 shadow-2xs cursor-pointer text-xs"
                      >
                        <option value="">Auto-Detect by Birthday (Default & Recommended)</option>
                        {effectiveMinistries.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} Application Form ({m.min_age ? `${m.min_age}-${m.max_age || '+'} yrs` : 'All Ages'})
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Active Form Type & Requirement Summary Banner */}
                    <div className="p-2.5 rounded-xl bg-white/90 border border-indigo-100 flex items-start gap-2 text-[12px] text-indigo-950 font-medium shadow-2xs">
                      <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        {currentModalMinistry ? (
                          <span>
                            Active Form: <strong className="text-indigo-900">{currentModalMinistry.name} Ministry</strong> — {getMinistryRequirementSummary(currentModalMinistry.name)}.
                          </span>
                        ) : (
                          <span className="text-charcoal/70">
                            Enter birthday below or pick a ministry above to load the exact paper application fields.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>



                  <form data-guide="member-application" ref={memberFormRef} onSubmit={handleSubmitMember} className="space-y-4 text-xs">
                    {/* Membership Classification & Water Baptism Settings */}
                    <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200/90 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="font-medium text-xs text-indigo-950 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-indigo-700" />
                          <span>Membership Classification & Baptism Status</span>
                        </label>
                        {/* Live Resulting Status Pill */}
                        {formData.status === "visitor" ? (
<Badge variant="warning" className="member-badge member-badge--guest">
                            Guest / Visitor
                          </Badge>
                        ) : formData.status === "inactive" ? (
<Badge variant="neutral" className="member-badge member-badge--inactive">
                            Inactive / Absent
                          </Badge>
                        ) : formData.baptism_status === "baptized" || formData.is_baptized ? (
<Badge variant="info" className="member-badge member-badge--baptized">
                            Baptized Regular Member
                          </Badge>
                        ) : (
<Badge variant="info" className="member-badge member-badge--regular">
                            Regular Member (Unbaptized)
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[12px] font-medium text-charcoal/80 mb-1">Base Membership Status</label>
                          <select data-guide="member-status"
                            value={formData.status}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full bg-white p-2 rounded-xl border border-indigo-200 font-medium text-xs text-indigo-950 focus:outline-none focus:border-indigo cursor-pointer shadow-2xs"
                          >
                            <option value="active">Active Regular Member</option>
                            <option value="visitor">Guest / Visitor (Bisita)</option>
                            <option value="inactive">Inactive / For Follow-up (Di-aktibo)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[12px] font-medium text-charcoal/80 mb-1">Baptism Status</label>
                          <select data-guide="member-baptism"
                            value={formData.baptism_status || (formData.is_baptized ? "baptized" : "not_baptized")}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData(prev => ({
                                ...prev,
                                baptism_status: val,
                                is_baptized: val === "baptized"
                              }));
                            }}
                            className="w-full bg-white p-2 rounded-xl border border-indigo-200 font-medium text-xs text-indigo-950 focus:outline-none focus:border-indigo cursor-pointer shadow-2xs"
                          >
                            <option value="baptized">Baptized</option>
                            <option value="not_baptized">Not Baptized</option>
                            <option value="candidate">Baptism Candidate</option>
                            <option value="scheduled">Scheduled for Baptism</option>
                          </select>
                        </div>
                      </div>

                      {(formData.baptism_status === "baptized" || formData.is_baptized) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-indigo-100/60">
                          <div>
                            <label className="block text-[12px] font-medium text-charcoal/70 mb-0.5">Baptism Date (Optional)</label>
                            <input
                              type="date"
                              value={formData.baptism_date || ""}
                              onChange={(e) => setFormData(prev => ({ ...prev, baptism_date: e.target.value }))}
                              className="w-full bg-white p-1.5 rounded-xl border border-indigo-200 text-xs font-medium text-indigo-950"
                            />
                          </div>
                          <div>
                            <label className="block text-[12px] font-medium text-charcoal/70 mb-0.5">Baptism Notes / Officiating</label>
                            <input
                              type="text"
                              placeholder="e.g. Baptized at DPC Pool"
                              value={formData.baptism_notes || ""}
                              onChange={(e) => setFormData(prev => ({ ...prev, baptism_notes: e.target.value }))}
                              className="w-full bg-white p-1.5 rounded-xl border border-indigo-200 text-xs text-charcoal"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Full Name & Birthday Side-by-Side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                      {/* Full Name with Live Duplicate Warning & Sample Guide */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-medium text-charcoal/70">Full Name *</label>
                          <span className="text-[12px] text-muted font-medium">First M.I. Last</span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="e.g. Mark Andrie M. Remot"
                            data-guide="member-name"
                            value={fullNameInput}
                            onChange={(e) => handleFullNameChange(e.target.value)}
                            className={`w-full bg-[var(--surface-2)] p-2.5 rounded-xl border text-xs font-medium transition-all focus:outline-none pr-9 ${liveDuplicateMember
                              ? "border-amber-400 bg-amber-50/40 text-amber-950 focus:border-amber-500 focus:ring-1 focus:ring-amber-400"
                              : duplicateCheck.state.status === "success"
                                ? "border-emerald-300 bg-emerald-50/20 focus:border-emerald-500"
                                : "border-gray-200 focus:border-indigo"
                              }`}
                          />
                          <div className="absolute right-2.5 top-2.5 pointer-events-none flex items-center">
                            {isCheckingDuplicate ? (
                              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                            ) : liveDuplicateMember ? (
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                            ) : duplicateCheck.state.status === "success" ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : null}
                          </div>
                        </div>

                        {/* Sample format guide */}
                        <div className="mt-1 flex items-center justify-between text-[12px] text-muted px-1">
                          <span>Sample: <strong className="text-charcoal/80">Juan M. Dela Cruz</strong></span>
                          <span className="text-muted">(Given Name + M.I. + Surname)</span>
                        </div>

                        {/* Live Duplicate Warning */}
                        {duplicateCheck.state.status === "error" && <div className="ui-error mt-2 space-y-2">
                          <p role="alert">The duplicate check could not finish. {duplicateCheck.state.error}</p>
                          <Button size="sm" onClick={duplicateCheck.retry}>Retry name check</Button>
                        </div>}
                        {liveDuplicateMember && (
                          <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-[12px] flex items-start gap-2 shadow-2xs animate-in fade-in duration-150">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="leading-tight">
                              <p className="font-medium text-amber-900">Name already registered in database!</p>
                              <p className="text-[12px] text-amber-800 mt-0.5">
                                <strong>{liveDuplicateMember.first_name} {liveDuplicateMember.last_name}</strong>
                                {liveDuplicateMember.ministry_name ? ` • ${liveDuplicateMember.ministry_name} Ministry` : ''}
                                {liveDuplicateMember.birthdate ? ` • Age: ${calculateClientAge(liveDuplicateMember.birthdate)}` : ''}
                                {` • ID #${liveDuplicateMember.id}`}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Birthdate & Real-time Auto-Suggestion */}
                      <div data-guide="member-birthday">
                        <DatePickerInput
                          label="Birthday (Calculates Age & Auto-suggests Ministry)"
                          required
                          value={formData.birthdate}
                          onChange={(val) => handleBirthdateChange(val)}
                          placeholder="Select birthdate"
                        />
                        {suggestedMinistryInfo && (
                          <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between flex-wrap gap-1.5 text-xs">
                            <span className="font-medium text-emerald-950 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Age: {suggestedMinistryInfo.age} yrs</span>
                            </span>
                            <span className="font-medium text-indigo-950 bg-white px-2 py-0.5 rounded-md shadow-2xs border border-indigo-200 text-[12px]">
                              {suggestedMinistryInfo.ministry?.name || "General"} Ministry
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Gender & Application Date (for Non-Kinder/Non-Elementary) */}
                    {(!isKinder && !isElementary) && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-medium text-charcoal/70 mb-1">Gender *</label>
                          <select
                            value={formData.gender}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                            className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo h-[41px] text-xs font-medium"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                        <div>
                          <DatePickerInput
                            label="Date of Application"
                            value={formData.application_date}
                            onChange={(val) => setFormData({ ...formData, application_date: val })}
                            placeholder="Select application date"
                          />
                        </div>
                      </div>
                    )}

                    {/* Civil Status / Marital Status Selector (Applicable ONLY for Junior Adult and Old Adult Ministries) */}
                    {(isJuniorAdult || isOldAdult) && (
                      <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/90 shadow-2xs space-y-2.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <label className="font-medium text-indigo-950 text-xs flex items-center gap-1.5">
                            <Heart className="w-4 h-4 text-rose-500 fill-rose-100" />
                            <span>Civil Status / Marital Status:</span>
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "Married", label: "Married", isSpecial: true },
                            { id: "Widowed", label: "Widowed" }
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleCivilStatusChange(item.id)}
                              className={`py-2 px-2.5 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${(formData.civil_status === item.id || (item.id === "Married" && formData.civil_status !== "Widowed"))
                                ? item.isSpecial
                                  ? "bg-amber-500 text-white border-amber-600 shadow-xs scale-[1.02]"
                                  : "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                                : "bg-white text-charcoal/80 border-gray-200 hover:bg-amber-50/40 hover:border-amber-300"
                                }`}
                            >
                              {item.id === "Married" && <Heart aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />}
                              <span>{item.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* When Married is Active: Show Spouse Search & Sub-Form Card */}
                        {(formData.civil_status === "Married" || formData.civil_status !== "Widowed") && (
                          <div className="mt-3 p-3.5 rounded-2xl bg-white border border-amber-300/90 shadow-2xs space-y-3 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between pb-2 border-b border-amber-100 flex-wrap gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm"><UIHeartHandshake aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /></span>
                                <span className="font-medium text-xs text-indigo-950">Spouse / Partner in Marriage</span>
                              </div>
                              <span className="text-[12px] bg-amber-100 text-amber-900 font-medium px-2 py-0.5 rounded-md">
                                Couples & Family Ministry
                              </span>
                            </div>

                            {/* Selected Spouse Confirmation Badge (if matched/chosen) */}
                            {formData.spouse_name && !createNewSpouseRecord ? (
                              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-medium text-xs flex items-center justify-center shadow-2xs"><UIHeartHandshake aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" />
                                  </div>
                                  <div>
                                    <span className="text-[12px] text-muted block font-medium">Linked Spouse</span>
                                    <span className="font-medium text-xs text-indigo-950">{formData.spouse_name}</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, spouse_name: "", spouse_id: "" }));
                                    setSpouseSearchQuery("");
                                  }}
                                  className="text-[12px] font-medium text-rose-600 hover:text-rose-800 underline cursor-pointer"
                                >
                                  Change / Remove
                                </button>
                              </div>
                            ) : !createNewSpouseRecord ? (
                              <div className="space-y-2">
                                <SearchableAutocomplete
                                  label="Search Spouse in Church Directory"
                                  value={spouseSearchQuery}
                                  onChange={(val) => {
                                    setSpouseSearchQuery(val);
                                  }}
                                  onSelect={(item) => {
                                    const source = allChurchMembers.length > 0 ? allChurchMembers : members;
                                    const matched = source.find(
                                      (m) => `${m.first_name || ""} ${m.last_name || ""}`.toLowerCase().trim() === item.title.toLowerCase().trim()
                                    );
                                    setFormData(prev => ({
                                      ...prev,
                                      spouse_name: item.title,
                                      spouse_id: matched ? String(matched.id) : ""
                                    }));
                                    setSpouseSearchQuery("");
                                  }}
                                  placeholder="Type to search existing member (e.g. Maria Clara)..."
                                  suggestions={spouseMemberSuggestions}
                                  icon={<Heart className="w-3.5 h-3.5 text-rose-500" />}
                                />

                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[12px] text-muted">
                                    Can't find spouse in the list?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCreateNewSpouseRecord(true);
                                      setFormData(prev => ({ ...prev, spouse_id: "", spouse_name: "" }));
                                      setSpouseSearchQuery("");
                                      setSpouseFormData(prev => ({
                                        ...prev,
                                        last_name: prev.last_name || formData.last_name,
                                        gender: formData.gender === "Male" ? "Female" : "Male"
                                      }));
                                    }}
                                    className="text-[12px] font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>+ Register Spouse as New Member</span>
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            {createNewSpouseRecord && (
                              <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-200 space-y-2">
                                <span className="font-medium text-indigo-950">Step 2 · Partner registration</span>
                                <p className="text-[12px] text-charcoal/70">
                                  {spouseFormData.first_name ? `${spouseFormData.first_name} ${spouseFormData.last_name} · ` : ""}
                                  Finish this member's details, then continue to the separate partner form.
                                </p>
                                <button type="button" onClick={() => setCreateNewSpouseRecord(false)} className="text-[12px] font-medium text-indigo-600 hover:underline">
                                  Switch back to Search
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Address (Cascading Philippine PSGC Selector) */}
                    <AddressPicker
                      label="Present Address"
                      required
                      value={formData.address}
                      onChange={(addr) => setFormData((prev) => ({ ...prev, address: addr }))}
                    />

                    {/* Ministry Assignment */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-medium text-charcoal/70 text-xs">Ministry Assignment</label>
                        <span className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-medium">
                          {coordinatorMinistryId ? "Coordinator Scope" : (formData.ministry_id ? "Assigned" : "Auto-Assigned by Age")}
                        </span>
                      </div>
                      <select data-guide="member-ministry"
                        value={coordinatorMinistryId ? String(coordinatorMinistryId) : formData.ministry_id}
                        onChange={(e) => setFormData({ ...formData, ministry_id: e.target.value })}
                        disabled={!!coordinatorMinistryId}
                        className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-charcoal disabled:opacity-90 disabled:bg-gray-100 text-xs"
                      >
                        {coordinatorMinistryId ? (
                          <option value={coordinatorMinistryId}>{coordinatorMinistryName} Ministry (Assigned)</option>
                        ) : (
                          <>
                            <option value="">Auto-Assign by Age</option>
                            {ministries.map((m) => (
                              <option key={m.id} value={m.id}>{m.name} ({m.min_age ? `${m.min_age}-${m.max_age || '+'} yrs` : 'All'})</option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>

                    {/* Enhanced Household & Family Linkage Section */}
                    <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <label className="font-medium text-indigo-950 text-xs flex items-center gap-1.5">
                            <Home className="w-4 h-4 text-indigo-700" />
                            <span>Your household</span>
                          </label>
                          <p className="text-[12px] text-muted mt-0.5">
                            {(isJuniorAdult || isOldAdult)
                              ? "Where you and your family live now. Create a household or join an existing one."
                              : "Where you live now. Join a household or keep an individual profile."}
                          </p>
                        </div>

                        {/* Mode Badge Indicator */}
                        <span className="text-[12px] font-medium px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-950 shadow-2xs">
                          {householdMode === "create_new" && <><UIPlus aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> New Household</>}
                          {householdMode === "existing" && <><UIClipboardList aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Existing Household</>}
                          {householdMode === "none" && <><UIUserRound aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Individual</>}
                        </span>
                      </div>

                      {/* Mode Switcher Buttons */}
                      <div className={`grid ${relativeRegistration ? "grid-cols-1" : "grid-cols-2"} gap-1.5 text-xs`}>
                        {(relativeRegistration ? [{ id: "existing", label: "Select List", icon: Clipboard, desc: "This family's household" }] : (isJuniorAdult || isOldAdult)
                          ? [
                            { id: "create_new", label: "Create New", icon: Plus, desc: "For new family", isHighlighted: formData.civil_status === "Married" },
                            { id: "existing", label: "Select List", icon: Clipboard, desc: "Pick household" }
                          ]
                          : [
                            { id: "existing", label: "Select List", icon: Clipboard, desc: "Pick household" },
                            { id: "none", label: "Individual", icon: UIUserRound, desc: "No household linked" }
                          ]
                        ).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (relativeRegistration) return;
                              setHouseholdMode(item.id as "create_new" | "existing" | "none");
                              setRegistrationFamilyMembers([]);
                              setHouseholdRegistrationRole("");
                              if (item.id === "create_new" && !newHouseholdName) {
                                setNewHouseholdName(`${formData.last_name ? `${formData.last_name} Household` : "New Family Household"}`);
                              }
                            }}
                            className={`py-2 px-2 rounded-xl font-medium text-[12px] transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer border ${householdMode === item.id
                              ? item.isHighlighted
                                ? "bg-amber-500 text-white border-amber-600 shadow-xs scale-[1.02]"
                                : "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                              : item.isHighlighted
                                ? "bg-amber-50/80 text-amber-950 border-amber-300 hover:bg-amber-100"
                                : "bg-white text-charcoal/80 border-gray-200 hover:bg-indigo-50/50 hover:border-indigo-300"
                              }`}
                          >
                            <span className="inline-flex items-center gap-1.5 font-medium"><item.icon aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />{item.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Mode 2: Create New Household */}
                      {canCreateHousehold && householdMode === "create_new" && (
                        <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-amber-950 flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5 text-amber-600" />
                              <span>Create New Family Household Record</span>
                            </span>
                            <span className="text-[12px] bg-amber-100 text-amber-900 font-medium px-2 py-0.5 rounded-md">
                              Independent Family
                            </span>
                          </div>

                          <div>
                            <label className="block text-[12px] font-medium text-charcoal/80 mb-1">
                              Household / Family Name *
                            </label>
                            <input
                              type="text"
                              required={householdMode === "create_new"}
                              placeholder="e.g. Dela Cruz Household / Juan & Maria Family"
                              value={newHouseholdName}
                              onChange={(e) => setNewHouseholdName(e.target.value)}
                              className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-amber-300 text-xs font-medium text-indigo-950 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-950 flex items-start gap-1.5">
                            <Home className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                            <span>
                              Created when you save, using the address above. Your selected or newly registered spouse will be included.
                            </span>
                          </div>
                          <div aria-label="Household preview" className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
                            <p className="text-xs font-semibold text-indigo-950">Members in this household</p>
                            <div className="grid sm:grid-cols-2 gap-2">
                              <div className="rounded-lg border border-indigo-100 bg-white p-3">
                                <p className="font-medium text-sm">{memberName(formData).trim() || 'Your name'} — {householdRegistrationRole ? householdRoleLabels[householdRegistrationRole] : 'Household member'}</p>
                                <p className="text-xs text-muted mt-1">You</p>
                              </div>
                              {formData.civil_status === 'Married' && (
                                <div className="rounded-lg border border-indigo-100 bg-white p-3">
                                  <p className="font-medium text-sm">{createNewSpouseRecord ? (spouseFormData.first_name.trim() ? `${spouseFormData.first_name} ${spouseFormData.last_name || formData.last_name}` : 'Register spouse in the next step') : (formData.spouse_name || 'Select your spouse above')}</p>
                                  <p className="text-xs text-muted mt-1">Spouse{createNewSpouseRecord ? ' · New member' : formData.spouse_id ? ' · Registered member' : formData.spouse_name ? ' · Name only' : ''}</p>
                                </div>
                              )}
                            </div>
                            {registrationFamilyMembers.map(relative=><p key={relative.member_id} className="text-xs">{relative.name} — {relative.relationship}</p>)}
                          </div>
                        </div>
                      )}

                      {/* Mode 3: Select Existing Household */}
                      {householdMode === "existing" && (
                        <div className="p-3 bg-white rounded-xl border border-indigo-100 space-y-2 animate-in fade-in duration-150">
                          <label className="block text-xs font-medium text-indigo-950 mb-1">
                            Select Registered Household:
                          </label>
                          <select data-guide="member-household"
                            value={formData.household_id}
                            disabled={!!relativeRegistration}
                            onChange={(e) => {
                              const id = e.target.value;
                              setFormData(prev => {
                                const previous = households.find(h => h.id === Number(prev.household_id));
                                const household = households.find(h => h.id === Number(id));
                                return {
                                  ...prev, household_id: id,
                                  address: !prev.address.trim() || prev.address === previous?.address ? household?.address || prev.address : prev.address
                                };
                              });
                              setRegistrationFamilyMembers([]);
                              setHouseholdRegistrationRole("");
                            }}
                            className="w-full bg-[var(--surface-2)] p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs text-indigo-950 cursor-pointer"
                          >
                            <option value="">-- Choose Existing Household --</option>
                            {households.map((h) => (
                              <option key={h.id} value={h.id}> {h.name} ({h.member_count || 0} family members)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {((canCreateHousehold && householdMode === "create_new") || householdMode === "existing") && (
                        <HouseholdRegistrationFields
                          key={householdMode}
                          members={(allChurchMembers.length ? allChurchMembers : members).filter(member =>
                            member.id !== editingMember?.id && member.id !== Number(formData.spouse_id))}
                          households={households}
                          household={householdMode === "existing" ? households.find(household => household.id === Number(formData.household_id)) : undefined}
                          name={memberName(formData)}
                          householdName={newHouseholdName}
                          isEditing={!!editingMember}
                          role={householdRegistrationRole}
                          married={formData.civil_status === 'Married'}
                          onRoleChange={setHouseholdRegistrationRole}
                          requireRelationship={householdMode === "existing"}
                          replacingRelativeName={relativeRegistration?.name}
                          allowFamilyLinking={canCreateHousehold && householdMode === "create_new"}
                          family={householdMode === "create_new" ? registrationFamilyMembers : []}
                          onFamilyChange={setRegistrationFamilyMembers}
                          onJoinHousehold={id => {
                            setHouseholdMode("existing");
                            setRegistrationFamilyMembers([]);
                            setFormData(prev => ({ ...prev, household_id: String(id) }));
                          }}
                          spouseName={formData.spouse_name || (createNewSpouseRecord ? memberName(spouseFormData) : "")}
                          showPreview={householdMode !== "create_new"}
                        />
                      )}

                      {/* Mode 4: Individual */}
                      {householdMode === "none" && (
                        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-[12px] text-charcoal/70 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <span>This member will be registered as a standalone individual profile (no household linked).</span>
                        </div>
                      )}
                    </div>

                    {isJuniorAdult && <ParentsHouseholdFields key={editingMember?.id||'new'} memberId={editingMember?.id} households={households} members={allChurchMembers.length?allChurchMembers:members} onChange={setFamilyLinks}/>}

                    {/* Contact Phone & Email */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-medium text-charcoal/70">Contact No *</label>
                          <span className={`text-[12px] font-medium ${formData.contact_phone.length === 11 ? "text-emerald-600" : "text-muted"}`}>
                            {formData.contact_phone.length}/11 digits
                          </span>
                        </div>
                        <input data-guide="member-contact"
                          type="tel"
                          required={!isKinder}
                          maxLength={11}
                          placeholder="e.g. 09123456789"
                          value={formData.contact_phone}
                          onChange={(e) => setFormData({ ...formData, contact_phone: sanitizePhoneInput(e.target.value) })}
                          className="w-full bg-[var(--surface-2)] p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-charcoal/70 mb-1">Contact Email</label>
                        <input
                          type="email"
                          placeholder="e.g. member@email.com"
                          value={formData.contact_email}
                          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                          className="w-full bg-[var(--surface-2)] p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
                        />
                      </div>
                    </div>

                    {/* ========================================================= */}
                    {/* DYNAMIC MINISTRY FORM SECTIONS (MATCHING PAPER FORMS)     */}
                    {/* ========================================================= */}

                    {householdMode !== "none" && (
                      <div className="space-y-2">
                        {useHouseholdGuardian && <p className="text-[12px] text-muted">Parents/guardian reflects the father first, then the mother, then the guardian. Edit the household to change these names.</p>}
                      </div>
                    )}

                    {(isKinder || isElementary || (!isHighSchool && !isYouth && !isYoungAdult && !isJuniorAdult && !isOldAdult)) && renderFamilyDetails()}

                    {/* 1. Kinder Ministry Form Fields */}
                    {isKinder && (
                      <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-3">
                        <h4 className="font-semibold text-amber-950 text-xs flex items-center gap-1.5">
                          <span>Kinder Ministry Application Requirements</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div data-guide="member-guardian">
                            <label className="block font-medium text-charcoal/70 mb-1">
                              Name of parents or guardian (relatives) *
                            </label>
                            <input
                              type="text"
                              required={isKinder}
                              placeholder="e.g. Juan & Maria Bautista"
                              value={applicationGuardianName}
                              readOnly={useHouseholdGuardian}
                              onChange={(e) => handleGuardianNameChange(e.target.value)}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block font-medium text-charcoal/70">
                                Contact number of parents *
                              </label>
                              {applicationGuardianPhone && (
                                <span className={`text-[12px] font-medium ${applicationGuardianPhone.length === 11 ? "text-emerald-600" : "text-muted"}`}>
                                  {applicationGuardianPhone.length}/11
                                </span>
                              )}
                            </div>
                            <input
                              type="tel"
                              required={isKinder}
                              maxLength={11}
                              placeholder="e.g. 09123456789"
                              value={applicationGuardianPhone}
                              readOnly={useHouseholdGuardian && !!linkedFamily.primaryPhone}
                              onChange={(e) => {
                                const cleaned = sanitizePhoneInput(e.target.value);
                                setFormData({
                                  ...formData,
                                  guardian_phone: cleaned,
                                  contact_phone: formData.contact_phone || cleaned
                                });
                              }}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs font-medium"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block font-medium text-charcoal/70 mb-1">
                            Medical / Allergy Notes (Crucial for Kinder) *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Peanut allergy, Asthma inhaler, None"
                            value={formData.medical_notes}
                            onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                            className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                          />
                        </div>
                      </div>
                    )}

                    {/* 2. Elementary Ministry Form Fields */}
                    {isElementary && (
                      <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 space-y-3">
                        <h4 className="font-semibold text-blue-950 text-xs flex items-center gap-1.5">
                          <span>Elementary Ministry Application Requirements</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <SearchableAutocomplete
                              label="Who Invites You in DPC? (Invitee)"
                              value={formData.invited_by}
                              onChange={(val) => setFormData({ ...formData, invited_by: val })}
                              placeholder="Search member name or type custom..."
                              suggestions={memberSuggestions}
                              icon={<Users className="w-3.5 h-3.5 text-indigo-600" />}
                            />
                          </div>
                          <div data-guide="member-guardian">
                            <label className="block font-medium text-charcoal/70 mb-1">
                              Name of Parents or Guardian
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Mr. & Mrs. Santos"
                              value={applicationGuardianName}
                              readOnly={useHouseholdGuardian}
                              onChange={(e) => handleGuardianNameChange(e.target.value)}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block font-medium text-charcoal/70 mb-1">
                            Medical / Allergy Notes
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Mild asthma, None"
                            value={formData.medical_notes}
                            onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                            className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                          />
                        </div>
                      </div>
                    )}

                    {/* 3. High School Ministry (Matches Photo 2) */}
                    {isHighSchool && (
                      <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-emerald-950 text-xs flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4 text-emerald-700" />
                            <span>High School Application Card Fields</span>
                          </h4>
                          <span className="text-[12px] bg-white text-emerald-800 font-medium px-2 py-0.5 rounded border border-emerald-200">
                            Physical Form Match
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <SearchableAutocomplete
                              label="School"
                              required={isHighSchool}
                              value={formData.school_name}
                              onChange={(val) => setFormData({ ...formData, school_name: val })}
                              placeholder="e.g. CNNHS / Daet National High School"
                              suggestions={PHILIPPINE_HIGH_SCHOOLS}
                              icon={<School className="w-3.5 h-3.5 text-emerald-600" />}
                            />
                          </div>
                          <div>
                            <SearchableAutocomplete
                              label="Year / Grade Level"
                              required={isHighSchool}
                              value={formData.grade_level}
                              onChange={(val) => setFormData({ ...formData, grade_level: val })}
                              placeholder="e.g. Grade 9 / Grade 11 - STEM"
                              suggestions={HIGH_SCHOOL_GRADE_LEVELS}
                              icon={<GraduationCap className="w-3.5 h-3.5 text-emerald-600" />}
                            />
                          </div>
                        </div>

                        {renderFamilyDetails("Family Members (Parents and number of siblings)", "e.g. Parents, 2 siblings")}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-medium text-charcoal/70 mb-1">Hobbies</label>
                            <input
                              type="text"
                              placeholder="e.g. Playing badminton, reading, studying"
                              value={formData.hobbies}
                              onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                            />
                          </div>
                          <div>
                            <SearchableAutocomplete
                              label="Who Invites You in DPC?"
                              value={formData.invited_by}
                              onChange={(val) => setFormData({ ...formData, invited_by: val })}
                              placeholder="Search member name or type custom..."
                              suggestions={memberSuggestions}
                              icon={<Users className="w-3.5 h-3.5 text-indigo-600" />}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. Youth Ministry Form Fields (Ages 18-26: Supports Students & Graduates) */}
                    {isYouth && (
                      <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200 space-y-3.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="font-semibold text-indigo-950 text-xs flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4 text-indigo-700" />
                            <span>Youth Ministry Application Form (Ages 18–26)</span>
                          </h4>
                          <span className="text-[12px] bg-white text-indigo-800 font-medium px-2 py-0.5 rounded border border-indigo-200 shadow-2xs">
                            Youth Scope (18–26)
                          </span>
                        </div>

                        {/* Educational / Career Status Switcher */}
                        <div className="p-1 bg-white/90 rounded-xl border border-indigo-200/80 flex items-center gap-1 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setYouthStatus("student")}
                            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${youthStatus === "student"
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-indigo-950/70 hover:text-indigo-900 hover:bg-indigo-50/60"
                              }`}
                          >
                            <School className="w-3.5 h-3.5" />
                            <span><UIGraduationCap aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Currently in College / University</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setYouthStatus("graduated");
                              setFormData(prev => ({ ...prev, class_schedule: "" }));
                            }}
                            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${youthStatus === "graduated"
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-indigo-950/70 hover:text-indigo-900 hover:bg-indigo-50/60"
                              }`}
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                            <span><UIBriefcase aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> College Graduate</span>
                          </button>
                        </div>

                        {/* Dynamic Fields for Student vs Graduate */}
                        {youthStatus === "student" ? (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <SearchableAutocomplete
                                  label="College / University"
                                  value={formData.school_name}
                                  onChange={(val) => setFormData({ ...formData, school_name: val })}
                                  placeholder="e.g. CNSC / Mabini Colleges / LCCD"
                                  suggestions={PHILIPPINE_COLLEGES_UNIVERSITIES}
                                  apiEndpoint="http://universities.hipolabs.com/search?country=Philippines"
                                  icon={<School className="w-3.5 h-3.5 text-indigo-600" />}
                                />
                              </div>
                              <div>
                                <SearchableAutocomplete
                                  label="Degree Program and Major"
                                  value={formData.program_major}
                                  onChange={(val) => setFormData({ ...formData, program_major: val })}
                                  placeholder="e.g. BS Information Technology, BS Nursing"
                                  suggestions={PHILIPPINE_DEGREE_PROGRAMS}
                                  icon={<BookOpen className="w-3.5 h-3.5 text-indigo-600" />}
                                />
                              </div>
                            </div>

                            {/* Class Schedule Builder - Exclusively for College Students */}
                            <div>
                              <ClassSchedulePicker
                                label="Class Schedule"
                                value={formData.class_schedule}
                                onChange={(val) => setFormData({ ...formData, class_schedule: val })}
                                placeholder="e.g. MWF 8:00 AM - 12:00 PM, Th-F 1:00 PM - 5:00 PM"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <SearchableAutocomplete
                                  label="College / University Graduated From"
                                  value={formData.school_name}
                                  onChange={(val) => setFormData({ ...formData, school_name: val })}
                                  placeholder="e.g. CNSC / Mabini Colleges / SLSU / PLM"
                                  suggestions={PHILIPPINE_COLLEGES_UNIVERSITIES}
                                  apiEndpoint="http://universities.hipolabs.com/search?country=Philippines"
                                  icon={<School className="w-3.5 h-3.5 text-indigo-600" />}
                                />
                              </div>
                              <div>
                                <SearchableAutocomplete
                                  label="Degree / Course Completed"
                                  value={formData.program_major}
                                  onChange={(val) => setFormData({ ...formData, program_major: val })}
                                  placeholder="e.g. BS Information Technology, BS Accountancy, AB Comm"
                                  suggestions={PHILIPPINE_DEGREE_PROGRAMS}
                                  icon={<BookOpen className="w-3.5 h-3.5 text-indigo-600" />}
                                />
                              </div>
                            </div>

                            {/* Work Status Selector: With Work vs No Work */}
                            <div className="space-y-2.5 bg-white/90 p-3 rounded-2xl border border-indigo-100 shadow-2xs">
                              <label className="block font-medium text-indigo-950 text-xs flex items-center gap-1.5">
                                <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Employment Status</span>
                              </label>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGradWorkStatus("with_work");
                                    if (!formData.occupation || formData.occupation === "No Work") {
                                      setFormData({ ...formData, occupation: "", class_schedule: "" });
                                    }
                                  }}
                                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${gradWorkStatus === "with_work"
                                    ? "bg-indigo-600 text-white shadow-xs font-medium"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                    }`}
                                >
                                  <Briefcase className="w-3.5 h-3.5" />
                                  <span>With Work / Employed</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGradWorkStatus("no_work");
                                    setFormData({ ...formData, occupation: "", class_schedule: "" });
                                  }}
                                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${gradWorkStatus === "no_work"
                                    ? "bg-indigo-600 text-white shadow-xs font-medium"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                    }`}
                                >
                                  <span>No Work / Currently Looking</span>
                                </button>
                              </div>

                              {gradWorkStatus === "with_work" ? (
                                <div className="pt-1">
                                  <label className="block font-medium text-charcoal/70 mb-1 text-[12px]">
                                    Current Occupation / Workplace
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Software Developer, Nurse, Teacher, BPO, Freelancer"
                                    value={formData.occupation}
                                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                                    className="w-full bg-white p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs"
                                  />
                                </div>
                              ) : (
                                <div className="pt-0.5">
                                  <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-2.5 text-[12px] text-amber-900 font-medium flex items-center gap-2">
                                    <span><UIInfo aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Graduate currently not working (e.g. Board Exam Reviewee, Job Seeking, or taking time off).</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderFamilyDetails("Family Members (Parents & siblings)", "e.g. Parents + 2 siblings")}
                          <div>
                            <label className="block font-medium text-charcoal/70 mb-1">Hobbies & Talents</label>
                            <input
                              type="text"
                              placeholder="e.g. Music, Guitar, Reading, Basketball"
                              value={formData.hobbies}
                              onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <SearchableAutocomplete
                              label="Who Invites You in DPC?"
                              value={formData.invited_by}
                              onChange={(val) => setFormData({ ...formData, invited_by: val })}
                              placeholder="Search member name or type custom..."
                              suggestions={memberSuggestions}
                              icon={<Users className="w-3.5 h-3.5 text-indigo-600" />}
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-charcoal/70 mb-1">Previous Church Attended</label>
                            <input
                              type="text"
                              placeholder="e.g. Daet Baptist / Catholic / None"
                              value={formData.previous_church}
                              onChange={(e) => setFormData({ ...formData, previous_church: e.target.value })}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 5. Young Adult Ministry Form Fields */}
                    {isYoungAdult && (
                      <div className="bg-[var(--surface-2)] p-3.5 rounded-xl border border-[var(--border)] space-y-3">
                        <h4 className="font-semibold text-[color:var(--text)] text-xs flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-[color:var(--text-muted)]" />
                          <span>Young Adult Application Card Fields</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-medium text-charcoal/70 mb-1">Occupation / Workplace</label>
                            <input
                              type="text"
                              placeholder="e.g. Software Engineer / Accountant / Teacher"
                              value={formData.occupation}
                              onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                            />
                          </div>
                          {renderFamilyDetails("Family Members (Parents & siblings)", "e.g. Parents, 1 brother")}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-medium text-charcoal/70 mb-1">Hobbies</label>
                            <input
                              type="text"
                              placeholder="e.g. Coffee brewing, hiking, reading"
                              value={formData.hobbies}
                              onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                            />
                          </div>
                          <div>
                            <SearchableAutocomplete
                              label="Who Invites You in DPC?"
                              value={formData.invited_by}
                              onChange={(val) => setFormData({ ...formData, invited_by: val })}
                              placeholder="Search member name or type custom..."
                              suggestions={memberSuggestions}
                              icon={<Users className="w-3.5 h-3.5 text-indigo-600" />}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block font-medium text-charcoal/70 mb-1">Previous Religion / Church</label>
                          <input
                            type="text"
                            placeholder="e.g. Roman Catholic / Seventh-day Adventist / None"
                            value={formData.previous_church}
                            onChange={(e) => setFormData({ ...formData, previous_church: e.target.value })}
                            className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                          />
                        </div>
                      </div>
                    )}

                    {/* 6. Junior Adult Ministry (Matches Photo 1) */}
                    {isJuniorAdult && (
                      <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-amber-950 text-xs flex items-center gap-1.5">
                            <Briefcase className="w-4 h-4 text-amber-700" />
                            <span>Junior Adult Application Card Fields</span>
                          </h4>
                          <span className="text-[12px] bg-white text-amber-900 font-medium px-2 py-0.5 rounded border border-amber-200">
                            Physical Card Match
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-medium text-charcoal/70 mb-1">Occupation</label>
                            <input
                              type="text"
                              placeholder="e.g. Office staff"
                              value={formData.occupation}
                              onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-charcoal/70 mb-1">Facebook Account</label>
                            <input
                              type="text"
                              placeholder="e.g. Fb: Zettsu"
                              value={formData.facebook_account}
                              onChange={(e) => setFormData({ ...formData, facebook_account: e.target.value })}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                            />
                          </div>
                        </div>

                        {renderFamilyDetails("Family Members", "e.g. Ziahannah Sky V. Deterra")}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-medium text-charcoal/70 mb-1">Hobbies</label>
                            <input
                              type="text"
                              placeholder="e.g. Reading & cooking"
                              value={formData.hobbies}
                              onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                            />
                          </div>
                          <div>
                            <SearchableAutocomplete
                              label="Who Invites You in DPC?"
                              value={formData.invited_by}
                              onChange={(val) => setFormData({ ...formData, invited_by: val })}
                              placeholder="Search member name or type custom..."
                              suggestions={memberSuggestions}
                              icon={<Users className="w-3.5 h-3.5 text-indigo-600" />}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 7. Old Adult / Senior Ministry */}
                    {isOldAdult && (
                      <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200 space-y-3">
                        <h4 className="font-semibold text-rose-950 text-xs flex items-center gap-1.5">
                          <span>Senior / Old Adult Application Card Fields</span>
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-medium text-charcoal/70 mb-1">Occupation / Status</label>
                            <input
                              type="text"
                              placeholder="e.g. Retired / Homemaker / Self-employed"
                              value={formData.occupation}
                              onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                              className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                            />
                          </div>
                          <div>
                            <SearchableAutocomplete
                              label="Who Invites You in DPC?"
                              value={formData.invited_by}
                              onChange={(val) => setFormData({ ...formData, invited_by: val })}
                              placeholder="Search member name or type custom..."
                              suggestions={memberSuggestions}
                              icon={<Users className="w-3.5 h-3.5 text-indigo-600" />}
                            />
                          </div>
                        </div>

                        {renderFamilyDetails("Family Members / Living With", "e.g. Living with son/daughter and grandchildren")}

                        <div>
                          <label className="block font-medium text-charcoal/70 mb-1">
                            Medical / Health Maintenance Instructions
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Hypertension maintenance, Needs walking assistance"
                            value={formData.medical_notes}
                            onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                            className="w-full bg-white p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                          />
                        </div>
                      </div>
                    )}

                    {/* Default Fallback for General / Unmatched */}
                    {(!isKinder && !isElementary && !isHighSchool && !isYouth && !isYoungAdult && !isJuniorAdult && !isOldAdult) && (
                      <div>
                        <label className="block font-medium text-charcoal/70 mb-1">Medical / Allergy Notes</label>
                        <input
                          type="text"
                          placeholder="e.g. Peanut allergy, Asthma inhaler"
                          value={formData.medical_notes}
                          onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                          className="w-full bg-[var(--surface-2)] p-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo"
                        />
                      </div>
                    )}

                    <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeMemberForm}
                        className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-charcoal hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        data-guide="member-save"
                        className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-medium shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>{isSavingMember ? "Saving..." : createNewSpouseRecord ? "Continue to Partner" : editingMember ? "Save Changes" : "Save Application Record"}</span>
                      </button>
                    </div>
                  </form>
                </ModalPanel>
                {registrationStep === "partner" && createNewSpouseRecord && (
                  <PartnerRegistrationModal spouseFormData={spouseFormData} setSpouseFormData={setSpouseFormData}
                    formData={formData} household={linkedHousehold} newHouseholdName={householdMode === 'create_new' ? newHouseholdName : undefined} memberName={fullNameInput} memberSuggestions={memberSuggestions}
                    onBack={backToMember} onSubmit={handleSubmitMember} isSaving={isSavingMember} />
                )}
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Add / Edit Household Modal */}
      {isAddHouseholdModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel role="dialog" aria-modal="true" aria-label={editingHousehold ? "Edit Household" : "Create Household"} className="directory-design bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-indigo-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div data-modal-header className="flex items-center justify-between pb-3 border-b border-indigo-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 shadow-2xs">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-charcoal">
                    {editingHousehold ? "Edit Household & Family" : "Create Household Family Group"}
                  </h2>
                  <p className="text-[12px] text-muted">Manage household address, parents, and family members</p>
                </div>
              </div>
              <button onClick={() => setIsAddHouseholdModalOpen(false)} className="p-1.5 text-muted hover:bg-gray-100 rounded-xl cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form data-guide="household-form" onSubmit={handleCreateHousehold} className="space-y-4 text-xs">
              {/* Section 1: Household Details */}
              <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/90 space-y-3">
                <span className="font-semibold text-xs text-indigo-950 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Household Information</span>
                </span>

                <div>
                  <label className="block font-medium text-charcoal/70 mb-1">Household Name *</label>
                  <input data-guide="household-name"
                    type="text"
                    required
                    placeholder="e.g. The Remot Family or Antonio Remot Household"
                    value={householdForm.name}
                    onChange={(e) => setHouseholdForm({ ...householdForm, name: e.target.value })}
                    className="w-full bg-white p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo font-medium text-xs text-charcoal shadow-2xs"
                  />
                </div>

                <div>
                  <AddressPicker
                    label="Primary Street Address"
                    value={householdForm.address}
                    onChange={(addr) => setHouseholdForm((prev) => ({ ...prev, address: addr }))}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-charcoal/70">Family Emergency Contact Phone</label>
                    {householdForm.primary_contact_phone && (
                      <span className={`text-[12px] font-medium ${householdForm.primary_contact_phone.length === 11 ? "text-emerald-600" : "text-muted"}`}>
                        {householdForm.primary_contact_phone.length}/11
                      </span>
                    )}
                  </div>
                  <input
                    type="tel"
                    maxLength={11}
                    placeholder="e.g. 09123456789"
                    value={householdForm.primary_contact_phone}
                    onChange={(e) => setHouseholdForm({ ...householdForm, primary_contact_phone: sanitizePhoneInput(e.target.value) })}
                    className="w-full bg-white p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo text-xs font-medium text-charcoal shadow-2xs"
                  />
                </div>
              </div>

              {/* Section 2: Parents / Household Heads */}
              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/90 space-y-3">
                <div>
                  <span className="font-semibold text-xs text-amber-950 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-700" />
                    <span>Couple / Household Heads</span>
                  </span>
                  <p className="text-[12px] text-muted mt-0.5">
                    Add the husband and wife here, even if they do not have children yet.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div data-guide="household-parents">
                    <SearchableAutocomplete
                      label="Husband's Name"
                      value={householdForm.father_name}
                      onChange={(name) => setHouseholdForm((prev) => ({ ...prev, father_name: name }))}
                      onSelect={(item) => setHouseholdForm((prev) => ({ ...prev, father_name: item.title }))}
                      placeholder="e.g. Antonio Remot"
                      suggestions={availableFamilyMembers.map(memberName)}
                      allowManualToggle={false}
                    />
                  </div>

                  <div>
                    <SearchableAutocomplete
                      label="Wife's Name"
                      value={householdForm.mother_name}
                      onChange={(name) => setHouseholdForm((prev) => ({ ...prev, mother_name: name }))}
                      onSelect={(item) => setHouseholdForm((prev) => ({ ...prev, mother_name: item.title }))}
                      placeholder="e.g. Marites Remot"
                      suggestions={availableFamilyMembers.map(memberName)}
                      allowManualToggle={false}
                    />
                  </div>
                </div>
              </div>

              <SearchableAutocomplete
                label="Guardian's Name (optional)"
                value={householdForm.guardian_name}
                onChange={name => setHouseholdForm(prev => ({ ...prev, guardian_name: name }))}
                onSelect={item => setHouseholdForm(prev => ({ ...prev, guardian_name: item.title }))}
                suggestions={availableFamilyMembers.map(memberName)}
                placeholder="Search guardian or type full name..."
                allowManualToggle={false}
              />

              {/* Section 3: Children & Other Family Members */}
              <div className="p-4 bg-white rounded-2xl border border-indigo-100 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-50 flex-wrap gap-2">
                  <div>
                    <h3 data-guide="household-family" className="font-semibold text-xs text-indigo-950 flex items-center gap-1.5">
                      <span>Children & Other Family Members</span>
                    </h3>
                    <p className="text-[12px] text-muted">
                      Add children, siblings, grandparents, or relatives in this home
                    </p>
                    <p className="text-[12px] text-muted mt-1">Son, Daughter, and Child connect to the couple above as their parents. Leave this list empty if there are no children or other relatives yet.</p>
                    {editingHousehold && <p className="text-[12px] text-muted mt-1">Removing a registered member unlinks them from this household and clears connections generated from this list. Their profile and manually recorded family relationships are kept.</p>}
                  </div>
                  <button
                    type="button"
                    disabled={isSavingHousehold}
                    onClick={() => {
                      const entry = { key: ++familyRowCounter.current, name: "", relationship: "Son", member_id: null };
                      setHouseholdFamilyDraft((prev) => [...prev, entry]);
                      setHouseholdFamilyError("");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-medium text-xs border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Add Family Member</span>
                  </button>
                </div>

                {householdFamilyError && (
                  <p role="alert" className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {householdFamilyError}
                  </p>
                )}

                {householdFamilyDraft.length === 0 ? (
                  <div className="p-4 text-center text-muted bg-[var(--surface-2)] rounded-xl border border-dashed border-indigo-100">
                    <p className="text-[12px]">No other family members added yet. Click <strong>"+ Add Family Member"</strong> to add children or relatives.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {householdFamilyDraft.map((entry, index) => {
                      const matchedMember = availableFamilyMembers.find((m) => m.id === entry.member_id || normalizeName(memberName(m)) === normalizeName(entry.name));
                      return (
                        <div key={entry.key} role="group" aria-label={`Family member ${index + 1}`} className="p-3 rounded-2xl bg-[var(--surface-2)] border border-indigo-100 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] font-semibold text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                                #{index + 1}
                              </span>
                              {matchedMember ? (
                                <span className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-medium px-2 py-0.5 rounded-md"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> DPC Member: {matchedMember.ministry_name || "Member"}{matchedMember.age ? ` (${matchedMember.age} yrs)` : ""}
                                </span>
                              ) : (
                                <span className="text-[12px] text-muted font-medium">Family Relative</span>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={isSavingHousehold}
                              onClick={() => {
                                setHouseholdFamilyDraft((prev) => prev.filter((row) => row.key !== entry.key));
                                setHouseholdFamilyError("");
                              }}
                              className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove member"
                              aria-label={`Remove family member ${index + 1}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <SearchableAutocomplete
                                label="Member Name"
                                required
                                value={entry.name}
                                onChange={(name) => updateHouseholdFamilyName(entry.key, name)}
                                onSelect={(item) => updateHouseholdFamilyName(entry.key, item.title)}
                                placeholder="Search member or type full name..."
                                allowManualToggle={false}
                                suggestions={availableFamilyMembers
                                  .filter((member) => !householdFamilyDraft.some((row) => row.key !== entry.key && row.member_id === member.id))
                                  .map((member) => ({ title: memberName(member), subtitle: `${member.ministry_name || "Church Member"}${member.age ? ` • ${member.age} yrs` : ""}` }))}
                              />
                            </div>

                            <div>
                              <label className="block text-[12px] font-medium text-charcoal/70 mb-1">
                                Relationship
                              </label>
                              <select
                                value={entry.relationship}
                                onChange={(e) =>
                                  setHouseholdFamilyDraft((prev) =>
                                    prev.map((row) => (row.key === entry.key ? { ...row, relationship: e.target.value } : row))
                                  )
                                }
                                className="w-full p-2 rounded-xl bg-white border border-gray-200 text-xs font-medium text-charcoal focus:outline-none focus:border-indigo shadow-2xs h-[37px]"
                              >
                                {familyRelationships.map((rel) => (
                                  <option key={rel} value={rel}>
                                    {rel}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div data-modal-footer className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddHouseholdModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 font-medium text-charcoal hover:bg-gray-200 transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button data-guide="household-save"
                  type="submit"
                  disabled={isSavingHousehold}
                  className="px-5 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white font-medium shadow-md transition-all active:scale-95 cursor-pointer text-xs disabled:opacity-50"
                >
                  {isSavingHousehold ? "Saving..." : editingHousehold ? "Save Household" : "Create Household"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* Birthday Greeting Modal */}
      {greetingMember && createPortal(
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="directory-design bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-indigo-100 animate-in fade-in zoom-in duration-200">
            <div data-modal-header className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <Cake className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-base text-charcoal">Send Birthday Blessing</h3>
                  <p className="text-xs text-muted">
                    To {greetingMember.first_name} {greetingMember.last_name} (Turning {greetingMember.turning_age || ((greetingMember.age ?? 0) + 1)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGreetingMember(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-muted hover:text-charcoal cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {greetingSuccess ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-sage-100 text-sage-700 mx-auto flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-charcoal text-base">Birthday Blessing Posted!</h4>
                <p className="text-xs text-muted">
                  A celebratory blessing has been published to the church announcement board.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1.5">
                    Pastoral Message & Scripture Blessing
                  </label>
                  <textarea
                    rows={4}
                    value={greetingMessage}
                    onChange={(e) => setGreetingMessage(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-indigo/20 focus:border-indigo"
                    placeholder="Write a warm birthday prayer or blessing..."
                  />
                </div>

                {/* Quick Scripture Presets */}
                <div>
                  <span className="text-[12px] font-medium text-muted block mb-1.5">
                    Insert Scripture Verse:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "Numbers 6:24-25 (Blessing)",
                        verse: `"The Lord bless you and keep you; the Lord make His face shine upon you and be gracious to you!" (Numbers 6:24-25)`
                      },
                      {
                        label: "Jeremiah 29:11 (Hope & Future)",
                        verse: `"For I know the plans I have for you, declares the Lord, plans to give you a future and a hope." (Jeremiah 29:11)`
                      },
                      {
                        label: "Psalm 20:4 (Desires of Heart)",
                        verse: `"May He grant you your heart's desire and fulfill all your plans!" (Psalm 20:4)`
                      },
                      {
                        label: "Psalm 118:24 (Rejoice)",
                        verse: `"This is the day that the Lord has made; let us rejoice and be glad in it!" (Psalm 118:24)`
                      }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const turning = greetingMember.turning_age || ((greetingMember.age ?? 0) + 1);
                          setGreetingMessage(
                            `Happy ${turning}th Birthday, ${greetingMember.first_name}!  ${item.verse} Praying God's richest blessings over your life!`
                          );
                        }}
                        className="text-[12px] font-medium bg-indigo-50 text-indigo hover:bg-indigo-100 px-2 py-1 rounded-md border border-indigo-100 transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setGreetingMember(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-charcoal/70 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendGreeting}
                    disabled={sendingGreeting || !greetingMessage.trim()}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingGreeting ? "Posting..." : "Publish Blessing"}</span>
                  </button>
                </div>
              </div>
            )}
          </ModalPanel>
        </div>,
        document.body
      )}
      {/* Dedicated Import & Document/Image Analyzer 2-Step Modal */}
      <MemberImportAnalyzeModal
        isOpen={isImportAnalyzeModalOpen}
        onClose={() => setIsImportAnalyzeModalOpen(false)}
        onApplyToForm={(parsed, file) => {
          setEditingMember(null);
          handleOpenAdd();
          if (file) {
            setImportedFileName(file.name);
          }
          applyParsedDataToForm(parsed, file ? file.name : "Analyzed Form");
        }}
        effectiveMinistries={effectiveMinistries}
        coordinatorMinistryId={coordinatorMinistryId}
        onMemberCreated={() => {
          loadData();
        }}
      />

      {/* Global Designed Confirmation / Alert Modal */}
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

      {/* Member Attendance Intelligence, Rates & Streaks Modal */}
      <MemberAttendanceSummaryModal
        member={attendanceSummaryMember}
        isOpen={!!attendanceSummaryMember}
        initialTab={attendanceSummaryInitialTab}
        onClose={() => setAttendanceSummaryMember(null)}
        onMemberUpdated={(updated) => {
          setMembers(prev => prev.map(m => m.id === attendanceSummaryMember?.id ? { ...m, ...updated } : m));
          if (selectedMember && selectedMember.id === attendanceSummaryMember?.id) {
            setSelectedMember(prev => prev ? { ...prev, ...updated } : null);
          }
        }}
      />
    </div>
  );
};
import { Badge } from "../components/common/Badge";

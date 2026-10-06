import { Check as UICheck, Lock as UILock } from "lucide-react";
import { ModalPanel } from "../components/common/ModalPanel";
import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../api";
import { useGuideDataState } from "../components/help/GuideDataContext";
import { User, Role, Ministry, Member } from "../types";
import { UsersPageSkeleton, TableSkeleton } from "../components/common/SkeletonLoader";
import {
  UserCog, Plus, Search, Filter, Shield, ShieldCheck,
  UserCheck, Users, HeartHandshake, UserPlus, Edit2, Trash2,
  Lock, Mail, Key, CheckCircle2, AlertCircle, RefreshCw, X,
  Check, ArrowRight, Eye, EyeOff, Building2, UserCircle2, BookOpen,
  Copy, CheckCheck, KeyRound, ShieldAlert, FileText, ExternalLink, Calendar, Phone
} from "lucide-react";
import { useSocketEvent } from "../socket";

export const UsersPage: React.FC = () => {
  const { user: currentUser, switchDemoUser, ministries } = useAuth();
  const { showToast, deleteWithUndo } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search States
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);

  // Modal States
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(false);

  // User Detail Modal State
  const [detailUser, setDetailUser] = useState<User | null>(null);

  // Password Reveal & Admin Authentication States
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, { password: string | null; isRevealed: boolean }>>({});
  const [copiedPasswordId, setCopiedPasswordId] = useState<number | null>(null);
  const [reAuthModal, setReAuthModal] = useState<{
    isOpen: boolean;
    targetUser: User | null;
    purpose: "reveal" | "reset";
    error: string | null;
    loading: boolean;
  }>({
    isOpen: false,
    targetUser: null,
    purpose: "reveal",
    error: null,
    loading: false
  });
  const [adminAuthPassword, setAdminAuthPassword] = useState("");
  const [showAdminAuthPassword, setShowAdminAuthPassword] = useState(false);

  // Password Reset Modal State
  const [resetPasswordModal, setResetPasswordModal] = useState<{
    isOpen: boolean;
    targetUser: User | null;
    newPassword: string;
    showPassword: boolean;
    error: string | null;
    loading: boolean;
  }>({
    isOpen: false,
    targetUser: null,
    newPassword: "",
    showPassword: false,
    error: null,
    loading: false
  });

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role_id: 4, // Default to Member
    ministry_ids: [] as number[],
    member_id: "" as string | number
  });
  const [memberSearch, setMemberSearch] = useState("");

  const filteredMembersForLink = useMemo(() => {
    let list = members;
    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase();
      list = members.filter(m => {
        const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
        const ministry = (m.ministry_name || "").toLowerCase();
        const email = (m.contact_email || "").toLowerCase();
        const phone = (m.contact_phone || "").toLowerCase();
        return fullName.includes(q) || ministry.includes(q) || email.includes(q) || phone.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
      const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [members, memberSearch]);

  const selectedLinkedMember = useMemo(() => {
    if (!formData.member_id) return null;
    return members.find(m => String(m.id) === String(formData.member_id)) || null;
  }, [members, formData.member_id]);


  useEffect(() => {
    loadAllData(users.length === 0);
  }, []);

  // Real-time synchronization
  useSocketEvent("users:changed", () => loadAllData(false));
  useSocketEvent("members:changed", () => loadAllData(false));
  useSocketEvent("ministries:changed", () => loadAllData(false));

 const loadAllData = async (isInitial = false) => {
    guideData.clearError();
    try {
      if (isInitial) {
        setLoading(true);
      }
      const [usersRes, rolesRes, membersRes] = await Promise.all([
        api.getUsers().catch(async err => {
          guideData.reportError(err);
          const demo = await api.getDemoUsers().catch(() => []);
          return demo;
        }),
        api.getRoles().catch(() => [
          { id: 1, name: "Admin", description: "Top Super Administrator (Root infrastructure & all users)" },
          { id: 2, name: "Pastor", description: "Senior Pastor / Church Executive (All ministries & operations)" },
          { id: 3, name: "Coordinator", description: "Ministry department leader" },
          { id: 4, name: "Leader", description: "Small group & discipleship leader" },
          { id: 5, name: "Volunteer", description: "Ministry helper & attendance facilitator" },
          { id: 6, name: "Member", description: "Regular church attendee / member" }
        ]),
        api.getMembers().catch(() => [])
      ]);
      setUsers(usersRes);
      setRoles(rolesRes);
      setMembers(membersRes);
    } catch (err: any) {
      console.error("Failed to load user management data:", err);
      guideData.reportError(err);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  const handleMemberSelect = (memberIdStr: string) => {
    if (!memberIdStr) {
      setFormData(prev => ({ ...prev, member_id: "" }));
      return;
    }

    const selectedMember = members.find(m => String(m.id) === String(memberIdStr));
    if (selectedMember) {
      const fullName = `${selectedMember.first_name} ${selectedMember.last_name}`.trim();
      const cleanFirst = selectedMember.first_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanLast = selectedMember.last_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const suggestedUsername = `${cleanFirst}.${cleanLast}`.trim();
      const defaultEmail = selectedMember.contact_email || "";

      setFormData(prev => ({
        ...prev,
        member_id: memberIdStr,
        name: fullName,
        email: defaultEmail,
        username: suggestedUsername,
        ministry_ids: selectedMember.ministry_id ? [selectedMember.ministry_id] : prev.ministry_ids
      }));
      showToast(`Auto-filled info for ${fullName}! Enter password and choose a role.`);
    } else {
      setFormData(prev => ({ ...prev, member_id: memberIdStr }));
    }
  };

  const handleOpenDetailModal = (u: User) => {
    setDetailUser(u);
  };

  const handleInitiateRevealPassword = (targetUser: User) => {
    const isTargetPrivileged = targetUser.role_name === "Admin" || targetUser.role_name === "Pastor" || targetUser.role_name === "IT Admin";
    if (isTargetPrivileged && currentUser?.role_name !== "Admin" && currentUser?.role_name !== "IT Admin") {
      showToast("Access denied. Only a Super Admin can reveal credentials for this account.", "error");
      return;
    }
    setReAuthModal({
      isOpen: true,
      targetUser,
      purpose: "reveal",
      error: null,
      loading: false
    });
    setAdminAuthPassword("");
    setShowAdminAuthPassword(false);
  };

  const handleInitiateResetPassword = (targetUser: User) => {
    const isTargetPrivileged = targetUser.role_name === "Admin" || targetUser.role_name === "Pastor" || targetUser.role_name === "IT Admin";
    if (isTargetPrivileged && currentUser?.role_name !== "Admin" && currentUser?.role_name !== "IT Admin") {
      showToast("Access denied. Only a Super Admin can reset password for this account.", "error");
      return;
    }
    setReAuthModal({
      isOpen: true,
      targetUser,
      purpose: "reset",
      error: null,
      loading: false
    });
    setAdminAuthPassword("");
    setShowAdminAuthPassword(false);
  };

  const handleConfirmAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminAuthPassword || !adminAuthPassword.trim()) {
      setReAuthModal(prev => ({ ...prev, error: "Please enter your administrator password" }));
      return;
    }
    if (!reAuthModal.targetUser) return;

    setReAuthModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      if (reAuthModal.purpose === "reveal") {
        const res = await api.revealUserPassword(reAuthModal.targetUser.id, adminAuthPassword.trim());
        setRevealedPasswords(prev => ({
          ...prev,
          [reAuthModal.targetUser!.id]: {
            password: res.password,
            isRevealed: true
          }
        }));
        setReAuthModal({ isOpen: false, targetUser: null, purpose: "reveal", error: null, loading: false });
        setAdminAuthPassword("");
        showToast(
          res.password
            ? `Real password revealed for ${reAuthModal.targetUser.name}`
            : `Security verified: Password for ${reAuthModal.targetUser.name} is encrypted`,
          "info"
        );
      } else if (reAuthModal.purpose === "reset") {
        // Verify admin password before opening reset dialog
        await api.verifyPassword(adminAuthPassword.trim());
        const target = reAuthModal.targetUser;
        const confirmedAdminPass = adminAuthPassword.trim();
        setReAuthModal({ isOpen: false, targetUser: null, purpose: "reveal", error: null, loading: false });
        setAdminAuthPassword(confirmedAdminPass);
        setResetPasswordModal({
          isOpen: true,
          targetUser: target,
          newPassword: "",
          showPassword: false,
          error: null,
          loading: false
        });
      }
    } catch (err: any) {
      setReAuthModal(prev => ({ ...prev, loading: false, error: err.message || "Authentication failed. Incorrect admin password." }));
    }
  };

  const handleConfirmPasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordModal.targetUser) return;
    if (!resetPasswordModal.newPassword || resetPasswordModal.newPassword.trim().length < 6) {
      setResetPasswordModal(prev => ({ ...prev, error: "New password must be at least 6 characters" }));
      return;
    }

    setResetPasswordModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      await api.resetUserPassword(resetPasswordModal.targetUser.id, {
        admin_password: adminAuthPassword || "admin123",
        new_password: resetPasswordModal.newPassword.trim()
      });
      setRevealedPasswords(prev => ({
        ...prev,
        [resetPasswordModal.targetUser!.id]: {
          password: resetPasswordModal.newPassword.trim(),
          isRevealed: true
        }
      }));
      showToast(`Password reset successfully for ${resetPasswordModal.targetUser.name}!`);
      setResetPasswordModal({ isOpen: false, targetUser: null, newPassword: "", showPassword: false, error: null, loading: false });
      setAdminAuthPassword("");
      loadAllData();
    } catch (err: any) {
      setResetPasswordModal(prev => ({ ...prev, loading: false, error: err.message || "Failed to reset password" }));
    }
  };

  const handleCopyPassword = (uId: number, pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedPasswordId(uId);
    showToast("Password copied to clipboard!");
    setTimeout(() => {
      setCopiedPasswordId(null);
    }, 2500);
  };

  const handleOpenUserModal = (targetUser?: User) => {
    setMemberSearch("");
    setShowFormPassword(false);
    if (targetUser) {
      setEditingUser(targetUser);
      setFormData({
        name: targetUser.name,
        username: targetUser.username || "",
        email: targetUser.email || "",
        password: "", // Blank in edit mode unless changing
        role_id: targetUser.role_id,
        ministry_ids: targetUser.ministries?.map(m => m.id) || [],
        member_id: targetUser.member_id || ""
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: "",
        username: "",
        email: "",
        password: "",
        role_id: 5, // Default Member
        ministry_ids: [],
        member_id: ""
      });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.name.trim()) {
        showToast("Please enter a user name", "error");
        return;
      }

      const trimmedEmail = formData.email.trim();
      if (trimmedEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
          showToast("Please enter a valid email address", "error");
          return;
        }

        const dupEmail = users.find(u => u.email && u.email.toLowerCase() === trimmedEmail.toLowerCase() && u.id !== editingUser?.id);
        if (dupEmail) {
          showToast("A user with this email address already exists", "error");
          return;
        }
      }

      let cleanUsername = formData.username.trim() ? formData.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") : "";
      if (cleanUsername) {
        const dupUser = users.find(u => u.username?.toLowerCase() === cleanUsername && u.id !== editingUser?.id);
        if (dupUser) {
          showToast("A user with this username already exists", "error");
          return;
        }
      }

      if (!editingUser && (!formData.password || formData.password.length < 6)) {
        showToast("Password must be at least 6 characters for new users", "error");
        return;
      }

      if (editingUser && formData.password && formData.password.trim().length > 0 && formData.password.trim().length < 6) {
        showToast("New password must be at least 6 characters", "error");
        return;
      }

      if (!formData.role_id) {
        showToast("Please select a user role", "error");
        return;
      }

      const payload = {
        name: formData.name.trim(),
        username: cleanUsername || undefined,
        email: trimmedEmail || undefined,
        password: formData.password ? formData.password.trim() : undefined,
        role_id: Number(formData.role_id),
        ministry_ids: formData.ministry_ids,
        member_id: formData.member_id ? Number(formData.member_id) : null
      };

      if (editingUser) {
        await api.updateUser(editingUser.id, payload);
        showToast(`User account '${formData.name}' updated successfully!`);
      } else {
        await api.createUser({
          ...payload,
          password: formData.password!
        });
        showToast(`User account '${formData.name}' created successfully!`);
      }

      setIsUserModalOpen(false);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to save user account", "error");
    }
  };

  const handleDeleteUser = () => {
    if (!deleteConfirmUser) return;
    const userToDelete = deleteConfirmUser;
    setDeleteConfirmUser(null);

    deleteWithUndo({
      itemName: userToDelete.name,
      itemType: "User account",
      onOptimisticDelete: () => {
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      },
      onRestore: () => {
        setUsers((prev) => {
          if (prev.some((u) => u.id === userToDelete.id)) return prev;
          return [...prev, userToDelete].sort((a, b) => a.id - b.id);
        });
      },
      onCommitDelete: async () => {
        await api.deleteUser(userToDelete.id);
      }
    });
  };

  const handleSwitchUser = async (u: User) => {
    try {
      await switchDemoUser(u.id);
      showToast(`Switched active demo session to ${u.name} (${u.role_name})!`);
    } catch (err: any) {
      showToast(err.message || "Failed to switch user", "error");
    }
  };

  const toggleMinistrySelection = (ministryId: number) => {
    setFormData(prev => {
      const exists = prev.ministry_ids.includes(ministryId);
      return {
        ...prev,
        ministry_ids: exists
          ? prev.ministry_ids.filter(id => id !== ministryId)
          : [...prev.ministry_ids, ministryId]
      };
    });
  };

  // Available roles for current modal (Pastor cannot create or assign Admin or Pastor)
  const availableRoles = useMemo(() => {
    if (currentUser?.role_name === "Pastor") {
      return roles.filter(r => !["Admin", "Pastor", "IT Admin"].includes(r.name));
    }
    return roles;
  }, [roles, currentUser?.role_name]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesRole = selectedRole === "all" ||
        u.role_name.toLowerCase() === selectedRole.toLowerCase() ||
        (selectedRole === "admin" && (u.role_name === "Admin" || u.role_name === "IT Admin")) ||
        (selectedRole === "pastor" && u.role_name === "Pastor");
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        u.name.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.role_name.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.linked_member_name && u.linked_member_name.toLowerCase().includes(q)) ||
        (u.ministries && u.ministries.some(m => m.name.toLowerCase().includes(q)))
      );
      return matchesRole && matchesSearch;
    });
  }, [users, selectedRole, searchQuery]);

  // Counts by Role
  const roleCounts = useMemo(() => {
    return {
      admin: users.filter(u => u.role_name === "Admin" || u.role_name === "IT Admin").length,
      pastor: users.filter(u => u.role_name === "Pastor").length,
      coordinator: users.filter(u => u.role_name === "Coordinator").length,
      leader: users.filter(u => u.role_name === "Leader").length,
      volunteer: users.filter(u => u.role_name === "Volunteer").length,
      member: users.filter(u => u.role_name === "Member").length
    };
  }, [users]);

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case "Admin":
      case "IT Admin":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-200 border border-cyan-500/40 text-xs font-medium shadow-2xs">
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-300" />
            <span>Admin (Super)</span>
          </span>
        );
      case "Pastor":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-medium shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
            <span>Pastor</span>
          </span>
        );
      case "Coordinator":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-medium shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Coordinator</span>
          </span>
        );
      case "Leader":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-100 text-sky-900 border border-sky-200 text-xs font-medium shadow-2xs">
            <BookOpen className="w-3.5 h-3.5 text-sky-700" />
            <span>Leader</span>
          </span>
        );
      case "Volunteer":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-medium shadow-2xs">
            <HeartHandshake className="w-3.5 h-3.5 text-amber-700" />
            <span>Volunteer</span>
          </span>
        );
      case "Member":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-medium shadow-2xs">
            <Users className="w-3.5 h-3.5 text-slate-600" />
            <span>Member</span>
          </span>
        );
    }
  };

  const guideData = useGuideDataState("users", { loading, count: filteredUsers.length, filtered: Boolean(searchQuery || selectedRole !== "all"), retry: () => loadAllData(true) });

  if (loading && users.length === 0) {
    return <UsersPageSkeleton />;
  }

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 lg:p-8 text-white shadow-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <img
          src="/container_bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35 mix-blend-screen pointer-events-none"
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/20 border border-cyan-300/30 text-cyan-200 text-xs font-medium uppercase tracking-wider backdrop-blur-md">
              <ShieldAlert className="w-3.5 h-3.5 text-cyan-300" />
              <span>Hierarchical RBAC & Security</span>
            </div>
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white tracking-tight">
            User Accounts & Role Permissions
          </h1>
          <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed font-medium">
            Manage system logins, assign ministry scopes, configure access boundaries for Admins (Super Administrator), Pastors (Senior Pastor / Church Executive), Coordinators, Leaders, Volunteers, and link accounts to church member profiles.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0 relative z-10">
          <button data-guide="users-matrix"
            onClick={() => setIsMatrixOpen(!isMatrixOpen)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white font-medium px-4 py-2.5 rounded-2xl text-xs backdrop-blur-md shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <ShieldCheck className="w-4 h-4 text-sky-300" />
            <span>{isMatrixOpen ? "Hide Permissions Matrix" : "Role Permissions Matrix"}</span>
          </button>

          <button data-guide="users-new"
            onClick={() => handleOpenUserModal()}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-indigo-950 font-medium text-xs py-2.5 px-5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-indigo-950" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* 6 Core Roles KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Admin (Super Admin) */}
        <div
          onClick={() => setSelectedRole(selectedRole === "admin" ? "all" : "admin")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${selectedRole === "admin"
              ? "border-cyan-500 ring-2 ring-cyan-500/20 bg-cyan-950/10"
              : "border-cyan-200/60 hover:border-cyan-400"
            }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-cyan-600 shrink-0" />
              <span className="text-xs font-medium text-cyan-950">Admin</span>
            </div>
            <div className="text-2xl font-medium text-cyan-950 tracking-tight">{roleCounts.admin}</div>
            <p className="text-[12px] text-muted font-medium">Super Admin</p>
          </div>
          <div className="p-3 bg-cyan-950 text-cyan-300 rounded-2xl shrink-0 border border-cyan-800">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>

        {/* 2. Pastor */}
        <div
          onClick={() => setSelectedRole(selectedRole === "pastor" ? "all" : "pastor")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${selectedRole === "pastor"
              ? "border-indigo ring-2 ring-indigo/20 bg-indigo-50/30"
              : "border-indigo-100/90 hover:border-indigo-300"
            }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo shrink-0" />
              <span className="text-xs font-medium text-indigo">Pastor</span>
            </div>
            <div className="text-2xl font-medium text-indigo tracking-tight">{roleCounts.pastor}</div>
            <p className="text-[12px] text-muted font-medium">Senior Pastor / Exec</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo rounded-2xl shrink-0 border border-indigo-100">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        {/* 3. Coordinator */}
        <div
          onClick={() => setSelectedRole(selectedRole === "coordinator" ? "all" : "coordinator")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${selectedRole === "coordinator"
              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30"
              : "border-emerald-100/90 hover:border-emerald-300"
            }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="text-xs font-medium text-emerald-800">Coordinators</span>
            </div>
            <div className="text-2xl font-medium text-emerald-900 tracking-tight">{roleCounts.coordinator}</div>
            <p className="text-[12px] text-muted font-medium">Dept. Overseers</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl shrink-0 border border-emerald-100">
            <Building2 className="w-4 h-4" />
          </div>
        </div>

        {/* 4. Leader */}
        <div
          onClick={() => setSelectedRole(selectedRole === "leader" ? "all" : "leader")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${selectedRole === "leader"
              ? "border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/30"
              : "border-sky-100/90 hover:border-sky-300"
            }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-sky-700 shrink-0" />
              <span className="text-xs font-medium text-sky-800">Leaders</span>
            </div>
            <div className="text-2xl font-medium text-sky-900 tracking-tight">{roleCounts.leader}</div>
            <p className="text-[12px] text-muted font-medium">Life Group Leaders</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-700 rounded-2xl shrink-0 border border-sky-100">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>

        {/* 5. Volunteer */}
        <div
          onClick={() => setSelectedRole(selectedRole === "volunteer" ? "all" : "volunteer")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${selectedRole === "volunteer"
              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30"
              : "border-amber-100/90 hover:border-amber-300"
            }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-xs font-medium text-amber-800">Volunteers</span>
            </div>
            <div className="text-2xl font-medium text-amber-900 tracking-tight">{roleCounts.volunteer}</div>
            <p className="text-[12px] text-muted font-medium">Service Helpers</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl shrink-0 border border-amber-100">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        {/* 6. Member */}
        <div
          onClick={() => setSelectedRole(selectedRole === "member" ? "all" : "member")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${selectedRole === "member"
              ? "border-slate-500 ring-2 ring-slate-500/20 bg-slate-50/40"
              : "border-slate-100/90 hover:border-slate-300"
            }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-700 shrink-0" />
              <span className="text-xs font-medium text-slate-800">Members</span>
            </div>
            <div className="text-2xl font-medium text-slate-900 tracking-tight">{roleCounts.member}</div>
            <p className="text-[12px] text-muted font-medium">Church Attendees</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl shrink-0 border border-slate-200">
            <UserCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Interactive Role Permissions Matrix */}
      {isMatrixOpen && (
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo rounded-xl border border-indigo-100">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-charcoal">Role Permissions Overview Matrix</h3>
                <p className="text-xs text-muted">
                  Feature access and functional capabilities across all 6 system roles.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsMatrixOpen(false)}
              className="p-1 hover:bg-gray-100 rounded-xl text-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-charcoal/80">
                  <th className="py-2.5 px-3 font-medium">Module / Feature</th>
                  <th className="py-2.5 px-3 font-medium text-cyan-900">Admin (Super)</th>
                  <th className="py-2.5 px-3 font-medium text-indigo">Pastor</th>
                  <th className="py-2.5 px-3 font-medium text-emerald-800">Coordinator</th>
                  <th className="py-2.5 px-3 font-medium text-sky-800">Leader</th>
                  <th className="py-2.5 px-3 font-medium text-amber-800">Volunteer</th>
                  <th className="py-2.5 px-3 font-medium text-slate-800">Member</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-charcoal/80 font-medium">
                <tr>
                  <td className="py-2.5 px-3 font-medium">Backups & Data Management</td>
                  <td className="py-2.5 px-3 text-cyan-700 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Full Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Notifications & SMTP Email Settings</td>
                  <td className="py-2.5 px-3 text-cyan-700 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Full Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">User Accounts & Roles Management</td>
                  <td className="py-2.5 px-3 text-cyan-700 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> All 6 Roles</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Coordinator, Leader, Volunteer, Member</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— Read Only</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">System Settings & Master Lookups</td>
                  <td className="py-2.5 px-3 text-cyan-700 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Full Access</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Full Access</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Ministry Lookups</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Members & Household Directory</td>
                  <td className="py-2.5 px-3 text-cyan-700 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> All Members</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> All Members</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Dept. Members</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Group Members</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Check-In Search</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Self Profile</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Bible Study Small Groups & Books</td>
                  <td className="py-2.5 px-3 text-cyan-700 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Create & Manage</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Create & Manage</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Dept. Groups</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Own Group & Roster</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Group Attendance</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Join & Study</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Announcements & Church Board</td>
                  <td className="py-2.5 px-3 text-cyan-700 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Pin & Moderate</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Pin & Moderate</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Post & Moderate</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— View Only</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> View Bulletins</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> View Bulletins</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Security Audit Logs</td>
                  <td className="py-2.5 px-3 text-cyan-700 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Full Audit Trail</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-medium"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Full Audit Trail</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                  <td className="py-2.5 px-3 text-muted font-medium">— No Access</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Search & Filter Toolbar */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-indigo-100/90 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Role Filter Pills */}
          <div data-guide="users-role-filter" className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: "all", label: "All Roles", icon: null, count: users.length },
              { id: "admin", label: "Admin", icon: <ShieldAlert className="w-3.5 h-3.5 text-cyan-500" />, count: roleCounts.admin },
              { id: "pastor", label: "Pastor", icon: <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />, count: roleCounts.pastor },
              { id: "coordinator", label: "Coordinator", icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />, count: roleCounts.coordinator },
              { id: "leader", label: "Leader", icon: <BookOpen className="w-3.5 h-3.5 text-sky-600" />, count: roleCounts.leader },
              { id: "volunteer", label: "Volunteer", icon: <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />, count: roleCounts.volunteer },
              { id: "member", label: "Member", icon: <Users className="w-3.5 h-3.5 text-slate-600" />, count: roleCounts.member }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setSelectedRole(filter.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${selectedRole === filter.id
                    ? "bg-indigo text-white shadow-md shadow-indigo-950/20"
                    : "bg-indigo-50/50 text-charcoal/70 hover:bg-indigo-50 border border-indigo-100/60"
                  }`}
              >
                {filter.icon}
                <span>{filter.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[12px] font-medium ${selectedRole === filter.id ? "bg-white/20 text-white" : "bg-white text-charcoal/70 shadow-2xs"
                  }`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input data-guide="users-search"
              type="text"
              placeholder="Search user name, email, ministry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-2xl border border-indigo-100 bg-indigo-50/30 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-indigo-100/90 shadow-sm overflow-hidden">
        {loading && users.length === 0 ? (
          <TableSkeleton rows={7} columns={5} />
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Users className="w-10 h-10 text-charcoal/30 mx-auto" />
            <p className="text-sm font-medium text-charcoal/70">No user accounts found matching your filter.</p>
            <button data-guide="users-new"
              onClick={() => handleOpenUserModal()}
              className="px-5 py-2.5 rounded-2xl bg-indigo text-white text-xs font-medium shadow-md hover:bg-indigo-900 transition-all cursor-pointer"
            >
              + Create User Account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-indigo-100/80 bg-indigo-50/40 text-charcoal/80 font-medium">
                  <th className="py-3.5 px-5">User Account</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Assigned Department(s)</th>
                  <th className="py-3.5 px-4">Linked Member Profile</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => {
                  const isCurrentSessionUser = currentUser?.id === u.id;
                  const isSuperAdmin = currentUser?.role_name === "Admin" || currentUser?.role_name === "IT Admin";
                  const isTargetPrivileged = u.role_name === "Admin" || u.role_name === "Pastor" || u.role_name === "IT Admin";
                  const canManageThisUser = isSuperAdmin || (!isTargetPrivileged && currentUser?.role_name === "Pastor");

                  return (
                    <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors group">
                      {/* Name & Email */}
                      <td className="py-4 px-5">
                        <div data-guide="users-details"
                          onClick={() => handleOpenDetailModal(u)}
                          className="flex items-center gap-3 cursor-pointer group-hover:opacity-95"
                          title="Click to view detailed user credentials and profile"
                        >
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo flex items-center justify-center font-medium text-sm border border-indigo-200/60 shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-charcoal flex items-center gap-1.5">
                              <span className="text-xs group-hover:text-indigo transition-colors">{u.name}</span>
                              {u.username && (
                                <span className="text-[12px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 font-medium">
                                  @{u.username}
                                </span>
                              )}
                              {isCurrentSessionUser && (
                                <span className="px-2 py-0.5 rounded-full text-[12px] font-medium bg-indigo text-white shadow-2xs">
                                  YOU
                                </span>
                              )}
                            </div>
                            {u.email ? (
                              <div className="text-[12px] text-muted flex items-center gap-1 mt-0.5 font-medium">
                                <Mail className="w-3 h-3 text-muted" />
                                <span>{u.email}</span>
                              </div>
                            ) : (
                              <div className="text-[10.5px] text-muted flex items-center gap-1 mt-0.5 font-medium italic">
                                <span>(No email registered)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4">
                        {getRoleBadge(u.role_name)}
                      </td>

                      {/* Assigned Ministries */}
                      <td className="py-4 px-4">
                        {(u.role_name === "Admin" || u.role_name === "IT Admin") ? (
                          <span className="text-[12px] font-medium text-cyan-300 bg-cyan-950 px-2.5 py-1 rounded-xl border border-cyan-800">
                            Universal / Infrastructure Root
                          </span>
                        ) : u.role_name === "Pastor" ? (
                          <span className="text-[12px] font-medium text-indigo bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">
                            All 7 Ministries (Church-Wide)
                          </span>
                        ) : (!u.ministries || u.ministries.length === 0) ? (
                          <span className="text-[12px] text-muted italic">
                            General Access
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {u.ministries.map(m => (
                              <span
                                key={m.id}
                                className="px-2.5 py-1 rounded-xl text-[12px] font-medium text-white shadow-2xs"
                                style={{ backgroundColor: m.color || "#2C3968" }}
                              >
                                {m.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Linked Member */}
                      <td className="py-4 px-4">
                        {u.linked_member_name ? (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="font-medium text-charcoal text-xs">{u.linked_member_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted text-[12px] italic">
                            Not Linked
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details Button */}
                          <button data-guide="users-details"
                            onClick={() => handleOpenDetailModal(u)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 text-[12px] font-medium border border-sky-200/60 transition-all cursor-pointer"
                            title={`View details & credentials for ${u.name}`}
                          >
                            <Eye className="w-3.5 h-3.5 text-sky-700" />
                            <span>Details</span>
                          </button>

                          {/* Demo Switch Button */}
                          <button
                            onClick={() => handleSwitchUser(u)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo text-[12px] font-medium border border-indigo-200/60 transition-all cursor-pointer"
                            title={`Switch to ${u.name}'s view`}
                          >
                            <Key className="w-3.5 h-3.5 text-indigo" />
                            <span>Switch</span>
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenUserModal(u)}
                            disabled={!canManageThisUser}
                            className={`p-2 rounded-xl transition-colors ${
                              !canManageThisUser
                                ? "text-gray-300 cursor-not-allowed"
                                : "hover:bg-indigo-50 text-charcoal/70 hover:text-indigo cursor-pointer"
                            }`}
                            title={!canManageThisUser ? "Only Super Admins can modify Admin and Pastor accounts" : "Edit user account"}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteConfirmUser(u)}
                            disabled={u.id === 1 || isCurrentSessionUser || !canManageThisUser}
                            className={`p-2 rounded-xl transition-colors ${u.id === 1 || isCurrentSessionUser || !canManageThisUser
                                ? "text-gray-300 cursor-not-allowed"
                                : "hover:bg-rose-50 text-rose-600 cursor-pointer"
                              }`}
                            title={u.id === 1 ? "Cannot delete root admin" : isCurrentSessionUser ? "Cannot delete own account" : !canManageThisUser ? "Only Super Admins can delete Admin and Pastor accounts" : "Delete user account"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* ==================================================== */}
      {/* MODAL: Create / Edit User Account */}
      {/* ==================================================== */}
      {isUserModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div data-modal-header className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo flex items-center justify-center font-medium border border-indigo-100">
                  <UserCog className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-charcoal">
                    {editingUser ? "Edit User Account" : "Add New User Account"}
                  </h3>
                  <p className="text-[12px] text-muted">
                    Configure login credentials, role permissions, and ministry linkages.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-xl text-muted hover:text-charcoal transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form data-guide="users-form" onSubmit={handleSaveUser} className="space-y-4">
              {/* Link to Church Member Profile (Placed at Top for Quick Auto-Fill) */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-sky-950 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-700" />
                    <span>Link to Church Member Profile (Auto-Fills Details)</span>
                  </label>
                  <span className="text-[12px] text-sky-800 font-medium bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200">
                    Fast Auto-Fill
                  </span>
                </div>

                {selectedLinkedMember ? (
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-sky-200 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 font-medium text-xs flex items-center justify-center shrink-0">
                        {selectedLinkedMember.first_name?.[0] || ""}{selectedLinkedMember.last_name?.[0] || ""}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-xs text-charcoal truncate">
                            {selectedLinkedMember.first_name} {selectedLinkedMember.last_name}
                          </span>
                          <span className="text-[12px] font-medium px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200">
                            {selectedLinkedMember.ministry_name || "General"}
                          </span>
                          <span className="text-[12px] text-muted capitalize font-medium">
                            • {selectedLinkedMember.status}
                          </span>
                        </div>
                        <p className="text-[12px] text-muted truncate font-medium">
                          {selectedLinkedMember.contact_email || "No email registered"} {selectedLinkedMember.contact_phone ? `• ${selectedLinkedMember.contact_phone}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleMemberSelect("");
                        setMemberSearch("");
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                      title="Unlink member profile"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Search Input Filter */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-sky-600 pointer-events-none" />
                      <input
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search member by name, ministry, or email..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl border border-sky-200 text-xs bg-white focus:ring-2 focus:ring-sky-400 focus:border-sky-500 outline-none font-medium text-charcoal placeholder:text-slate-400"
                      />
                      {memberSearch && (
                        <button
                          type="button"
                          onClick={() => setMemberSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Filtered Dropdown */}
                    <select
                      value={formData.member_id}
                      onChange={(e) => {
                        handleMemberSelect(e.target.value);
                        setMemberSearch("");
                      }}
                      size={filteredMembersForLink.length > 0 && memberSearch ? Math.min(filteredMembersForLink.length + 1, 6) : 1}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-sky-200 text-xs bg-white focus:ring-2 focus:ring-sky-400 focus:border-sky-500 outline-none font-medium text-charcoal cursor-pointer"
                    >
                      <option value="">
                        {memberSearch
                          ? `-- Found ${filteredMembersForLink.length} disciples (Click to select) --`
                          : "-- Choose Member to Auto-Fill Credentials --"}
                      </option>
                      {filteredMembersForLink.map(m => (
                        <option key={m.id} value={m.id} className="py-1">
                          {m.first_name} {m.last_name} ({m.ministry_name || "General"} • {m.status})
                        </option>
                      ))}
                      {filteredMembersForLink.length === 0 && (
                        <option disabled value="">
                          No church members found matching "{memberSearch}"
                        </option>
                      )}
                    </select>
                  </div>
                )}

                <p className="text-[12px] text-sky-800/80 leading-tight">
                  Selecting a member automatically populates their Full Name, suggested Username, and Email.
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal">Full Name *</label>
                <input data-guide="users-name"
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins, Marcus Vance..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                />
              </div>

              {/* Username & Email Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-charcoal flex items-center justify-between">
                    <span>Username</span>
                    <span className="text-[12px] text-muted font-normal">Optional handle</span>
                  </label>
                  <input data-guide="users-login"
                    type="text"
                    placeholder="e.g. sarah.jenkins"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-charcoal flex items-center justify-between">
                    <span>Email Address</span>
                    <span className="text-[12px] text-muted font-normal">Optional</span>
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. coordinator.kinder@church.org (optional)"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal flex items-center justify-between">
                  <span>Password {editingUser ? "(Leave blank to keep unchanged)" : "*"}</span>
                  <span className="text-[12px] text-muted font-normal">Min 6 characters</span>
                </label>
                <div className="relative">
                  <input data-guide="users-password"
                    type={showFormPassword ? "text" : "password"}
                    required={!editingUser}
                    placeholder={editingUser ? "•••••••• (Leave blank to keep current)" : "Enter account password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-charcoal transition-colors cursor-pointer rounded-lg hover:bg-gray-100"
                    title={showFormPassword ? "Hide password" : "Show password"}
                  >
                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role Selection (Dynamic RBAC Roles from Database) */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-charcoal">System Role & Permissions *</label>
                <div data-guide="users-role" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableRoles.map(r => {
                    const roleDisplayMeta: Record<string, { icon: React.ReactNode; desc: string }> = {
                      "Admin": { icon: <ShieldAlert className="w-4 h-4 text-cyan-500" />, desc: "Tier 1 Super Admin (Root Infrastructure)" },
                      "IT Admin": { icon: <ShieldAlert className="w-4 h-4 text-cyan-500" />, desc: "Tier 1 Super Admin (Root Infrastructure)" },
                      "Pastor": { icon: <ShieldCheck className="w-4 h-4 text-indigo-700" />, desc: "Senior Pastor / Church Executive (All Ministries)" },
                      "Coordinator": { icon: <ShieldCheck className="w-4 h-4 text-emerald-700" />, desc: "Ministry Leader" },
                      "Leader": { icon: <BookOpen className="w-4 h-4 text-sky-700" />, desc: "Small Group / Life Leader" },
                      "Volunteer": { icon: <HeartHandshake className="w-4 h-4 text-amber-700" />, desc: "Attendance Helper" },
                      "Member": { icon: <Users className="w-4 h-4 text-slate-700" />, desc: "Church Attendee" }
                    };
                    const meta = roleDisplayMeta[r.name] || {
                      icon: <Users className="w-4 h-4 text-slate-700" />,
                      desc: r.description || "Standard Role"
                    };

                    return (
                      <div
                        key={r.id}
                        onClick={() => setFormData({ ...formData, role_id: r.id })}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${formData.role_id === r.id
                            ? "border-indigo bg-indigo-50/60 ring-2 ring-indigo/20 shadow-xs"
                            : "border-gray-200 hover:border-indigo-200 bg-white"
                          }`}
                      >
                        <div className="p-1.5 rounded-xl bg-white shadow-2xs shrink-0 mt-0.5 border border-gray-100">
                          {meta.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-xs text-charcoal truncate">{r.name}</div>
                          <div className="text-[9.5px] text-muted leading-tight line-clamp-2">{meta.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Department Assignment for Coordinators / Leaders / Volunteers */}
              {(() => {
                const currentRoleObj = roles.find(r => r.id === formData.role_id);
                const isMinistryRole = currentRoleObj ? ["Coordinator", "Leader", "Volunteer"].includes(currentRoleObj.name) : false;
                if (!isMinistryRole) return null;

                return (
                  <div className="space-y-2 p-3.5 rounded-2xl bg-amber-50/40 border border-amber-200/70">
                    <label className="text-xs font-medium text-charcoal flex items-center justify-between">
                      <span>Assigned Ministry Departments ({formData.ministry_ids.length} selected)</span>
                      <span className="text-[12px] text-amber-800 font-medium">Optional for Coordinators, Leaders & Volunteers</span>
                    </label>
                    <div data-guide="users-ministries" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ministries.map(min => {
                        const isChecked = formData.ministry_ids.includes(min.id);
                        return (
                          <button
                            type="button"
                            key={min.id}
                            onClick={() => toggleMinistrySelection(min.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition-all cursor-pointer ${isChecked
                                ? "bg-indigo text-white border-indigo shadow-2xs"
                                : "bg-white text-charcoal/80 border-gray-200 hover:border-gray-300"
                              }`}
                          >
                            <span className="truncate">{min.name}</span>
                            {isChecked && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Submit Buttons */}
              <div data-modal-footer className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-medium text-charcoal/70 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button data-guide="users-save"
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-medium text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  {editingUser ? "Save User Changes" : "Create User Account"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ==================================================== */}
      {/* MODAL: Delete Confirmation */}
      {/* ==================================================== */}
      {deleteConfirmUser && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div data-modal-header className="space-y-4"><div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-charcoal">Delete User Account?</h3>
              <p className="text-xs text-muted mt-1">
                Are you sure you want to delete <strong>{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})? This action cannot be undone.
              </p>
            </div></div>
            <div data-modal-footer className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2.5 rounded-2xl text-xs font-medium text-charcoal/70 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-medium transition-all shadow-md cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ==================================================== */}
      {/* MODAL: User Account & Security Details */}
      {/* ==================================================== */}
      {detailUser && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-indigo-100 space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div data-modal-header className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-3xl bg-indigo-950 text-amber-300 flex items-center justify-center font-medium text-xl shadow-md border-2 border-amber-300/40 shrink-0">
                  {detailUser.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg text-charcoal">{detailUser.name}</h3>
                    {getRoleBadge(detailUser.role_name)}
                    {currentUser?.id === detailUser.id && (
                      <span className="px-2 py-0.5 rounded-full text-[12px] font-medium bg-indigo text-white shadow-2xs">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted font-medium">
                    {detailUser.username && (
                      <span className="font-mono text-indigo font-medium bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        @{detailUser.username}
                      </span>
                    )}
                    <span>User ID #{detailUser.id}</span>
                    {detailUser.created_at && (
                      <span>• Created {new Date(detailUser.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setDetailUser(null)}
                className="p-1.5 hover:bg-gray-100 rounded-xl text-muted hover:text-charcoal transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Security & Credentials */}
            <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo" />
                  <h4 className="font-semibold text-xs text-indigo-950 uppercase tracking-wider">
                    Login Credentials & Security
                  </h4>
                </div>
                <span className="text-[12px] font-medium text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Authentication Access
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Email Address */}
                <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-1">
                  <span className="text-[12px] text-muted font-medium block uppercase">Email Address</span>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-charcoal truncate font-mono text-[12px]">
                      {detailUser.email || <span className="italic text-muted font-sans font-normal">(No email registered)</span>}
                    </span>
                    {detailUser.email && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(detailUser.email || "");
                          showToast("Email copied!");
                        }}
                        className="p-1 text-muted hover:text-indigo hover:bg-indigo-50 rounded-md transition-colors"
                        title="Copy Email"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Username Handle */}
                <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-1">
                  <span className="text-[12px] text-muted font-medium block uppercase">Sign-in Handle</span>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-charcoal truncate font-mono text-[12px]">
                      {detailUser.username ? `@${detailUser.username}` : "(Not set)"}
                    </span>
                    {detailUser.username && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(detailUser.username || "");
                          showToast("Username copied!");
                        }}
                        className="p-1 text-muted hover:text-indigo hover:bg-indigo-50 rounded-md transition-colors"
                        title="Copy Username"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Password Reveal Box */}
              <div className="p-3.5 bg-white rounded-xl border border-indigo-100 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted font-medium block uppercase">
                    Account Password
                  </span>
                  {revealedPasswords[detailUser.id]?.isRevealed && (
                    <span className={`text-[12px] font-medium px-2 py-0.5 rounded-md border ${
                      revealedPasswords[detailUser.id].password
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : "text-amber-800 bg-amber-50 border-amber-200"
                    }`}>
                      {revealedPasswords[detailUser.id].password ? <><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Real Password Verified</> : <><UILock aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Bcrypt Encrypted</>}
                    </span>
                  )}
                </div>

                {revealedPasswords[detailUser.id]?.isRevealed ? (
                  revealedPasswords[detailUser.id].password ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <Lock className="w-4 h-4 text-indigo shrink-0" />
                          <span className="font-mono font-medium text-sm text-indigo tracking-wider select-all truncate">
                            {revealedPasswords[detailUser.id].password}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(detailUser.id, revealedPasswords[detailUser.id].password!)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo font-medium text-[12px] rounded-lg border border-indigo-200 shadow-2xs transition-all cursor-pointer"
                          >
                            {copiedPasswordId === detailUser.id ? (
                              <>
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRevealedPasswords(prev => {
                                const next = { ...prev };
                                delete next[detailUser.id];
                                return next;
                              });
                            }}
                            className="px-2 py-1 text-muted hover:text-charcoal hover:bg-white rounded-lg transition-colors text-[12px] font-medium"
                            title="Hide password"
                          >
                            Hide
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-amber-900 font-medium text-xs">
                          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Encrypted Password (Bcrypt Hash)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRevealedPasswords(prev => {
                              const next = { ...prev };
                              delete next[detailUser.id];
                              return next;
                            });
                          }}
                          className="px-2 py-0.5 text-muted hover:text-charcoal text-[12px] font-medium"
                        >
                          Hide
                        </button>
                      </div>
                      <p className="text-[12px] text-amber-800 leading-relaxed font-medium">
                        This user account was created with a one-way cryptographic hash before credential tracking was active. You can set or assign a new temporary password directly.
                      </p>
                      <button data-guide="users-reset-password"
                        type="button"
                        onClick={() => handleInitiateResetPassword(detailUser)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Assign / Reset Password</span>
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 text-muted font-mono text-sm tracking-widest">
                      <Lock className="w-4 h-4 text-muted" />
                      <span>••••••••••••</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInitiateRevealPassword(detailUser)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-medium text-xs shadow-xs hover:shadow transition-all cursor-pointer active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-950" />
                      <span>Reveal Password</span>
                    </button>
                  </div>
                )}

                <p className="text-[12px] text-muted leading-tight">
                  Viewing another user's credential requires administrator password re-authentication for privacy & audit compliance.
                </p>
              </div>
            </div>

            {/* Section 2: Role Permissions & Ministries */}
            <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <h4 className="font-semibold text-xs text-charcoal uppercase tracking-wider">
                    Role & Assigned Ministry Departments
                  </h4>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted font-medium">Assigned Role:</span>
                  <span className="font-medium text-xs text-charcoal">{detailUser.role_name}</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted font-medium shrink-0 pt-0.5">Ministries:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(detailUser.role_name === "Admin" || detailUser.role_name === "IT Admin") ? (
                      <span className="text-[12px] font-medium text-cyan-300 bg-cyan-950 px-2.5 py-1 rounded-xl border border-cyan-800">
                        Root Infrastructure & Universal Access
                      </span>
                    ) : detailUser.role_name === "Pastor" ? (
                      <span className="text-[12px] font-medium text-indigo bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">
                        All 7 Ministries (Church-Wide Access)
                      </span>
                    ) : (!detailUser.ministries || detailUser.ministries.length === 0) ? (
                      <span className="text-[12px] text-muted italic">General church attendee access</span>
                    ) : (
                      detailUser.ministries.map(m => (
                        <span
                          key={m.id}
                          className="px-2.5 py-1 rounded-xl text-[12px] font-medium text-white shadow-2xs"
                          style={{ backgroundColor: m.color || "#2C3968" }}
                        >
                          {m.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Linked Church Member Profile */}
            <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-sky-700" />
                  <h4 className="font-semibold text-xs text-sky-950 uppercase tracking-wider">
                    Linked Church Member Profile
                  </h4>
                </div>
              </div>

              {detailUser.linked_member_name ? (
                <div className="p-3 bg-white rounded-xl border border-sky-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs text-charcoal">{detailUser.linked_member_name}</span>
                    <span className="text-[12px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"><UICheck aria-hidden="true" className="inline-block w-[1em] h-[1em] align-[-0.125em] shrink-0" /> Profile Linked
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] text-charcoal/70">
                    {detailUser.contact_phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-sky-600" />
                        <span>{detailUser.contact_phone}</span>
                      </div>
                    )}
                    {detailUser.contact_email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-sky-600" />
                        <span>{detailUser.contact_email}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white/80 rounded-xl border border-dashed border-sky-300 text-center space-y-1">
                  <p className="text-xs text-muted font-medium">No church member profile is currently linked to this user account.</p>
                  <button
                    type="button"
                    onClick={() => {
                      const u = detailUser;
                      setDetailUser(null);
                      handleOpenUserModal(u);
                    }}
                    className="text-[12px] font-medium text-indigo hover:underline cursor-pointer"
                  >
                    + Link a member profile now
                  </button>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div data-modal-footer className="flex items-center justify-between pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleSwitchUser(detailUser)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo text-xs font-medium border border-indigo-200 transition-all cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-indigo" />
                <span>Switch to User</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const u = detailUser;
                    setDetailUser(null);
                    handleOpenUserModal(u);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-charcoal text-xs font-medium transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailUser(null)}
                  className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 text-xs font-medium transition-all shadow-md cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ==================================================== */}
      {/* MODAL: Admin Security Re-Authentication */}
      {/* ==================================================== */}
      {reAuthModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[110] bg-charcoal/70 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-amber-300 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div data-modal-header className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-charcoal">Security Re-Authentication</h3>
                  <p className="text-[12px] text-muted">Administrator verification required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReAuthModal({ isOpen: false, targetUser: null, purpose: "reveal", error: null, loading: false })}
                className="p-1 hover:bg-gray-100 rounded-xl text-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-charcoal/80 leading-relaxed bg-amber-50/60 p-3 rounded-2xl border border-amber-200">
              To inspect or manage sensitive login credentials for <strong>{reAuthModal.targetUser?.name}</strong>, please enter your administrator account password.
            </p>

            {reAuthModal.error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{reAuthModal.error}</span>
              </div>
            )}

            <form onSubmit={handleConfirmAdminAuth} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal">Admin Password</label>
                <div className="relative">
                  <input
                    type={showAdminAuthPassword ? "text" : "password"}
                    required
                    autoFocus
                    placeholder="Enter your administrator password"
                    value={adminAuthPassword}
                    onChange={(e) => setAdminAuthPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-amber-400 focus:border-amber-500 outline-none font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminAuthPassword(!showAdminAuthPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-charcoal rounded-lg cursor-pointer hover:bg-gray-100"
                    title={showAdminAuthPassword ? "Hide password" : "Show password"}
                  >
                    {showAdminAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div data-modal-footer className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReAuthModal({ isOpen: false, targetUser: null, purpose: "reveal", error: null, loading: false })}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-charcoal/70 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reAuthModal.loading}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-medium text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {reAuthModal.loading ? "Verifying..." : "Verify & Reveal"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}

      {/* ==================================================== */}
      {/* MODAL: Quick Password Reset */}
      {/* ==================================================== */}
      {resetPasswordModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[110] bg-charcoal/70 backdrop-blur-sm flex items-center justify-center p-4">
          <ModalPanel data-modal-panel className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-indigo-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div data-modal-header className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo flex items-center justify-center border border-indigo-200">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-charcoal">Reset Account Password</h3>
                  <p className="text-[12px] text-muted">{resetPasswordModal.targetUser?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordModal({ isOpen: false, targetUser: null, newPassword: "", showPassword: false, error: null, loading: false })}
                className="p-1 hover:bg-gray-100 rounded-xl text-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetPasswordModal.error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{resetPasswordModal.error}</span>
              </div>
            )}

            <form data-guide="users-password-reset-form" onSubmit={handleConfirmPasswordResetSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-charcoal flex items-center justify-between">
                  <span>New Password</span>
                  <span className="text-[12px] text-muted font-normal">Min 6 characters</span>
                </label>
                <div className="relative">
                  <input
                    type={resetPasswordModal.showPassword ? "text" : "password"}
                    required
                    placeholder="Enter new password"
                    value={resetPasswordModal.newPassword}
                    onChange={(e) => setResetPasswordModal(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setResetPasswordModal(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-charcoal rounded-lg cursor-pointer hover:bg-gray-100"
                  >
                    {resetPasswordModal.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div data-modal-footer className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordModal({ isOpen: false, targetUser: null, newPassword: "", showPassword: false, error: null, loading: false })}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-charcoal/70 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordModal.loading}
                  className="px-5 py-2 rounded-xl bg-indigo text-white hover:bg-indigo-900 font-medium text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {resetPasswordModal.loading ? "Saving..." : "Save New Password"}
                </button>
              </div>
            </form>
          </ModalPanel>
        </div>,
        document.body
      )}
    </div>
  );
};

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { User, Role, Ministry, Member } from "../types";
import {
  UserCog, Plus, Search, Filter, Shield, ShieldCheck,
  UserCheck, Users, HeartHandshake, UserPlus, Edit2, Trash2,
  Lock, Mail, Key, CheckCircle2, AlertCircle, RefreshCw, X,
  Check, ArrowRight, Eye, Sparkles, Building2, UserCircle2, BookOpen
} from "lucide-react";

export const UsersPage: React.FC = () => {
  const { user: currentUser, switchDemoUser, ministries } = useAuth();
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
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

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

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, membersRes] = await Promise.all([
        api.getUsers().catch(async () => {
          const demo = await api.getDemoUsers().catch(() => []);
          return demo;
        }),
        api.getRoles().catch(() => [
          { id: 1, name: "Admin", description: "Full administrative privileges" },
          { id: 2, name: "Coordinator", description: "Ministry department leader" },
          { id: 3, name: "Leader", description: "Small group & discipleship leader" },
          { id: 4, name: "Volunteer", description: "Ministry helper & attendance facilitator" },
          { id: 5, name: "Member", description: "Regular church attendee / member" }
        ]),
        api.getMembers().catch(() => [])
      ]);
      setUsers(usersRes);
      setRoles(rolesRes);
      setMembers(membersRes);
    } catch (err: any) {
      console.error("Failed to load user management data:", err);
    } finally {
      setLoading(false);
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
      const defaultEmail = selectedMember.contact_email || `${suggestedUsername}@church.org`;

      setFormData(prev => ({
        ...prev,
        member_id: memberIdStr,
        name: fullName,
        email: defaultEmail,
        username: suggestedUsername,
        ministry_ids: selectedMember.ministry_id ? [selectedMember.ministry_id] : prev.ministry_ids
      }));
      showToast(`✓ Auto-filled info for ${fullName}! Enter password and choose a role.`);
    } else {
      setFormData(prev => ({ ...prev, member_id: memberIdStr }));
    }
  };

  const handleOpenUserModal = (targetUser?: User) => {
    if (targetUser) {
      setEditingUser(targetUser);
      setFormData({
        name: targetUser.name,
        username: targetUser.username || "",
        email: targetUser.email,
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
      if (!formData.name.trim() || !formData.email.trim()) {
        showToast("Please enter a name and email address", "error");
        return;
      }

      if (!editingUser && (!formData.password || formData.password.length < 6)) {
        showToast("Password must be at least 6 characters for new users", "error");
        return;
      }

      const payload = {
        name: formData.name.trim(),
        username: formData.username.trim() || undefined,
        email: formData.email.trim(),
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

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      await api.deleteUser(deleteConfirmUser.id);
      showToast(`User account '${deleteConfirmUser.name}' was deleted.`);
      setDeleteConfirmUser(null);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete user account", "error");
    }
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

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesRole = selectedRole === "all" || u.role_name.toLowerCase() === selectedRole.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role_name.toLowerCase().includes(q) ||
        (u.linked_member_name && u.linked_member_name.toLowerCase().includes(q)) ||
        (u.ministries && u.ministries.some(m => m.name.toLowerCase().includes(q)))
      );
      return matchesRole && matchesSearch;
    });
  }, [users, selectedRole, searchQuery]);

  // Counts by Role
  const roleCounts = useMemo(() => {
    return {
      admin: users.filter(u => u.role_name === "Admin").length,
      coordinator: users.filter(u => u.role_name === "Coordinator").length,
      leader: users.filter(u => u.role_name === "Leader").length,
      volunteer: users.filter(u => u.role_name === "Volunteer").length,
      member: users.filter(u => u.role_name === "Member").length
    };
  }, [users]);

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case "Admin":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold shadow-2xs">
            <Shield className="w-3.5 h-3.5 text-indigo-700" />
            <span>Admin</span>
          </span>
        );
      case "Coordinator":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Coordinator</span>
          </span>
        );
      case "Leader":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-100 text-sky-900 border border-sky-200 text-xs font-bold shadow-2xs">
            <BookOpen className="w-3.5 h-3.5 text-sky-700" />
            <span>Leader</span>
          </span>
        );
      case "Volunteer":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold shadow-2xs">
            <HeartHandshake className="w-3.5 h-3.5 text-amber-700" />
            <span>Volunteer</span>
          </span>
        );
      case "Member":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold shadow-2xs">
            <Users className="w-3.5 h-3.5 text-slate-600" />
            <span>Member</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border animate-in slide-in-from-bottom-5 duration-200 ${
          toastMessage.type === "success" 
            ? "bg-emerald-900 text-white border-emerald-700 shadow-emerald-950/20"
            : "bg-rose-900 text-white border-rose-700 shadow-rose-950/20"
        }`}>
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 lg:p-8 border border-indigo-100/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-gradient-to-br from-indigo-500/5 via-amber-500/5 to-transparent rounded-full blur-2xl pointer-events-none"></div>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-4 ring-amber-100/50">
              <UserCog className="w-5 h-5" />
            </span>
            <h1 className="text-2xl lg:text-3xl font-black text-indigo tracking-tight">
              User Accounts & Permissions
            </h1>
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200/80 text-xs font-black uppercase tracking-wider shadow-2xs">
              Access & Role Management
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70 max-w-2xl leading-relaxed font-medium">
            Manage system logins, assign ministry departments, configure permissions for Admins, Coordinators, Leaders, Volunteers, and link accounts to church member profiles.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0 relative z-10">
          <button
            onClick={() => setIsMatrixOpen(!isMatrixOpen)}
            className="flex items-center gap-2 bg-white hover:bg-indigo-50/60 border border-indigo-200/80 text-charcoal font-bold px-4 py-2.5 rounded-2xl text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-indigo" />
            <span>{isMatrixOpen ? "Hide Permissions Matrix" : "Role Permissions Matrix"}</span>
          </button>

          <button
            onClick={() => handleOpenUserModal()}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs py-2.5 px-5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-indigo-950" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {/* 5 Core Roles KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Admin */}
        <div 
          onClick={() => setSelectedRole(selectedRole === "admin" ? "all" : "admin")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${
            selectedRole === "admin" 
              ? "border-indigo ring-2 ring-indigo/20 bg-indigo-50/30" 
              : "border-indigo-100/90 hover:border-indigo-300"
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo shrink-0" />
              <span className="text-xs font-black text-indigo">Admins</span>
            </div>
            <div className="text-2xl font-black text-indigo tracking-tight">{roleCounts.admin}</div>
            <p className="text-[10px] text-charcoal/60 font-semibold">Full System Access</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo rounded-2xl shrink-0 border border-indigo-100">
            <Lock className="w-4 h-4" />
          </div>
        </div>

        {/* 2. Coordinator */}
        <div 
          onClick={() => setSelectedRole(selectedRole === "coordinator" ? "all" : "coordinator")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${
            selectedRole === "coordinator" 
              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30" 
              : "border-emerald-100/90 hover:border-emerald-300"
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="text-xs font-black text-emerald-800">Coordinators</span>
            </div>
            <div className="text-2xl font-black text-emerald-900 tracking-tight">{roleCounts.coordinator}</div>
            <p className="text-[10px] text-charcoal/60 font-semibold">Dept. Overseers</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl shrink-0 border border-emerald-100">
            <Building2 className="w-4 h-4" />
          </div>
        </div>

        {/* 3. Leader */}
        <div 
          onClick={() => setSelectedRole(selectedRole === "leader" ? "all" : "leader")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${
            selectedRole === "leader" 
              ? "border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/30" 
              : "border-sky-100/90 hover:border-sky-300"
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-sky-700 shrink-0" />
              <span className="text-xs font-black text-sky-800">Leaders</span>
            </div>
            <div className="text-2xl font-black text-sky-900 tracking-tight">{roleCounts.leader}</div>
            <p className="text-[10px] text-charcoal/60 font-semibold">Life Group Leaders</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-700 rounded-2xl shrink-0 border border-sky-100">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>

        {/* 4. Volunteer */}
        <div 
          onClick={() => setSelectedRole(selectedRole === "volunteer" ? "all" : "volunteer")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${
            selectedRole === "volunteer" 
              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30" 
              : "border-amber-100/90 hover:border-amber-300"
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-xs font-black text-amber-800">Volunteers</span>
            </div>
            <div className="text-2xl font-black text-amber-900 tracking-tight">{roleCounts.volunteer}</div>
            <p className="text-[10px] text-charcoal/60 font-semibold">Service Helpers</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl shrink-0 border border-amber-100">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        {/* 5. Member */}
        <div 
          onClick={() => setSelectedRole(selectedRole === "member" ? "all" : "member")}
          className={`bg-white/95 backdrop-blur-md rounded-3xl p-5 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-3 ${
            selectedRole === "member" 
              ? "border-slate-500 ring-2 ring-slate-500/20 bg-slate-50/40" 
              : "border-slate-100/90 hover:border-slate-300"
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-700 shrink-0" />
              <span className="text-xs font-black text-slate-800">Members</span>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">{roleCounts.member}</div>
            <p className="text-[10px] text-charcoal/60 font-semibold">Church Attendees</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl shrink-0 border border-slate-200">
            <UserCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Optional: Interactive Role Permissions Matrix */}
      {isMatrixOpen && (
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 border border-indigo-100/90 shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo rounded-xl border border-indigo-100">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-charcoal">Role Permissions Overview Matrix</h3>
                <p className="text-xs text-charcoal/60">
                  Feature access and functional capabilities for each of the 5 system roles.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsMatrixOpen(false)}
              className="p-1 hover:bg-gray-100 rounded-xl text-charcoal/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-charcoal/80">
                  <th className="py-2.5 px-3 font-black">Module / Feature</th>
                  <th className="py-2.5 px-3 font-black text-indigo">Admin</th>
                  <th className="py-2.5 px-3 font-black text-emerald-800">Coordinator</th>
                  <th className="py-2.5 px-3 font-black text-sky-800">Leader</th>
                  <th className="py-2.5 px-3 font-black text-amber-800">Volunteer</th>
                  <th className="py-2.5 px-3 font-black text-slate-800">Member</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-charcoal/80 font-medium">
                <tr>
                  <td className="py-2.5 px-3 font-bold">User Accounts & Roles CRUD</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Full Access</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— Read Only</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— No Access</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— No Access</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— No Access</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold">System Settings & Master Lookups</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Full Access</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Ministry Lookups</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— No Access</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— No Access</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— No Access</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold">Members & Household Directory</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ All Members</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Dept. Members</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Group Members</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Check-In Search</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Self Profile</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold">Bible Study Small Groups & Books</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Create & Manage</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Dept. Groups</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Own Group & Roster</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Group Attendance</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Join & Study</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold">Announcements & Prayer Wall</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Pin & Moderate</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Post & Moderate</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Post & Moderate</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Pray & View</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Submit & Pray</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold">Security Audit Logs</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-black">✓ Full Audit Trail</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— No Access</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— No Access</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— No Access</td>
                  <td className="py-2.5 px-3 text-charcoal/40 font-semibold">— No Access</td>
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
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: "all", label: "All Roles", icon: null, count: users.length },
              { id: "admin", label: "Admin", icon: <Shield className="w-3.5 h-3.5 text-indigo-700" />, count: roleCounts.admin },
              { id: "coordinator", label: "Coordinator", icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />, count: roleCounts.coordinator },
              { id: "leader", label: "Leader", icon: <BookOpen className="w-3.5 h-3.5 text-sky-600" />, count: roleCounts.leader },
              { id: "volunteer", label: "Volunteer", icon: <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />, count: roleCounts.volunteer },
              { id: "member", label: "Member", icon: <Users className="w-3.5 h-3.5 text-slate-600" />, count: roleCounts.member }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setSelectedRole(filter.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedRole === filter.id
                    ? "bg-indigo text-white shadow-md shadow-indigo-950/20"
                    : "bg-indigo-50/50 text-charcoal/70 hover:bg-indigo-50 border border-indigo-100/60"
                }`}
              >
                {filter.icon}
                <span>{filter.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  selectedRole === filter.id ? "bg-white/20 text-white" : "bg-white text-charcoal/70 shadow-2xs"
                }`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
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
        {loading ? (
          <div className="flex items-center justify-center py-16 space-x-2 text-indigo">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-xs font-bold">Loading user directory...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Users className="w-10 h-10 text-charcoal/30 mx-auto" />
            <p className="text-sm font-bold text-charcoal/70">No user accounts found matching your filter.</p>
            <button
              onClick={() => handleOpenUserModal()}
              className="px-5 py-2.5 rounded-2xl bg-indigo text-white text-xs font-bold shadow-md hover:bg-indigo-900 transition-all cursor-pointer"
            >
              + Create User Account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-indigo-100/80 bg-indigo-50/40 text-charcoal/80 font-black">
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

                  return (
                    <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors">
                      {/* Name & Email */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/80 text-indigo flex items-center justify-center font-black text-sm border border-indigo-200/60 shadow-2xs shrink-0">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-charcoal flex items-center gap-1.5">
                              <span className="text-xs">{u.name}</span>
                              {u.username && (
                                <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 font-bold">
                                  @{u.username}
                                </span>
                              )}
                              {isCurrentSessionUser && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo text-white shadow-2xs">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-charcoal/60 flex items-center gap-1 mt-0.5 font-medium">
                              <Mail className="w-3 h-3 text-charcoal/40" />
                              <span>{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4">
                        {getRoleBadge(u.role_name)}
                      </td>

                      {/* Assigned Ministries */}
                      <td className="py-4 px-4">
                        {u.role_name === "Admin" ? (
                          <span className="text-[11px] font-bold text-indigo bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">
                            All 7 Ministries (Church-Wide)
                          </span>
                        ) : (!u.ministries || u.ministries.length === 0) ? (
                          <span className="text-[11px] text-charcoal/40 italic">
                            General Access
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {u.ministries.map(m => (
                              <span
                                key={m.id}
                                className="px-2.5 py-1 rounded-xl text-[10px] font-black text-white shadow-2xs"
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
                            <span className="font-bold text-charcoal text-xs">{u.linked_member_name}</span>
                          </div>
                        ) : (
                          <span className="text-charcoal/40 text-[11px] italic">
                            Not Linked
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Demo Switch Button */}
                          <button
                            onClick={() => handleSwitchUser(u)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo text-[11px] font-bold border border-indigo-200/60 transition-all cursor-pointer"
                            title={`Switch to ${u.name}'s view`}
                          >
                            <Key className="w-3.5 h-3.5 text-indigo" />
                            <span>Switch</span>
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenUserModal(u)}
                            className="p-2 hover:bg-indigo-50 text-charcoal/70 hover:text-indigo rounded-xl transition-colors cursor-pointer"
                            title="Edit user account"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteConfirmUser(u)}
                            disabled={u.id === 1 || isCurrentSessionUser}
                            className={`p-2 rounded-xl transition-colors ${
                              u.id === 1 || isCurrentSessionUser
                                ? "text-gray-300 cursor-not-allowed"
                                : "hover:bg-rose-50 text-rose-600 cursor-pointer"
                            }`}
                            title={u.id === 1 ? "Cannot delete root admin" : isCurrentSessionUser ? "Cannot delete own account" : "Delete user account"}
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
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-indigo-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo flex items-center justify-center font-bold border border-indigo-100">
                  <UserCog className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-charcoal">
                    {editingUser ? "Edit User Account" : "Add New User Account"}
                  </h3>
                  <p className="text-[11px] text-charcoal/60">
                    Configure login credentials, role permissions, and ministry linkages.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-xl text-charcoal/50 hover:text-charcoal transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              {/* Link to Church Member Profile (Placed at Top for Quick Auto-Fill) */}
              <div className="space-y-1.5 p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200">
                <label className="text-xs font-bold text-sky-950 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-700" />
                    <span>Link to Church Member Profile (Auto-Fills Details)</span>
                  </span>
                  <span className="text-[10px] text-sky-800 font-bold bg-sky-100 px-2 py-0.5 rounded-md">
                    Fast Auto-Fill
                  </span>
                </label>
                <select
                  value={formData.member_id}
                  onChange={(e) => handleMemberSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sky-200 text-xs bg-white focus:ring-2 focus:ring-sky-400 focus:border-sky-500 outline-none font-medium text-charcoal"
                >
                  <option value="">-- Choose Member to Auto-Fill Credentials --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.ministry_name || "General"} • {m.status})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-sky-800/80 leading-tight">
                  Selecting a member automatically populates their Full Name, suggested Username, and Email.
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal">Full Name *</label>
                <input
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
                  <label className="text-xs font-bold text-charcoal flex items-center justify-between">
                    <span>Username</span>
                    <span className="text-[10px] text-charcoal/50 font-normal">Optional handle</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. sarah.jenkins"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-charcoal">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. coordinator.kinder@church.org"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-charcoal flex items-center justify-between">
                  <span>Password {editingUser ? "(Leave blank to keep unchanged)" : "*"}</span>
                  <span className="text-[10px] text-charcoal/50 font-normal">Min 6 characters</span>
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  placeholder={editingUser ? "••••••••" : "Enter account password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none font-medium"
                />
              </div>

              {/* Role Selection (Dynamic 5 RBAC Roles from Database) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-charcoal">System Role & Permissions *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {roles.map(r => {
                    const roleDisplayMeta: Record<string, { icon: React.ReactNode; desc: string }> = {
                      "Admin": { icon: <Shield className="w-4 h-4 text-indigo" />, desc: "Full System Access" },
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
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                          formData.role_id === r.id
                            ? "border-indigo bg-indigo-50/60 ring-2 ring-indigo/20 shadow-xs"
                            : "border-gray-200 hover:border-indigo-200 bg-white"
                        }`}
                      >
                        <div className="p-1.5 rounded-xl bg-white shadow-2xs shrink-0 mt-0.5 border border-gray-100">
                          {meta.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-charcoal truncate">{r.name}</div>
                          <div className="text-[9.5px] text-charcoal/60 leading-tight line-clamp-2">{meta.desc}</div>
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
                    <label className="text-xs font-bold text-charcoal flex items-center justify-between">
                      <span>Assigned Ministry Departments ({formData.ministry_ids.length} selected)</span>
                      <span className="text-[10px] text-amber-800 font-semibold">Optional for Coordinators, Leaders & Volunteers</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ministries.map(min => {
                        const isChecked = formData.ministry_ids.includes(min.id);
                        return (
                          <button
                            type="button"
                            key={min.id}
                            onClick={() => toggleMinistrySelection(min.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border text-left flex items-center justify-between transition-all cursor-pointer ${
                              isChecked
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
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-charcoal/70 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  {editingUser ? "Save User Changes" : "Create User Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: Delete Confirmation */}
      {/* ==================================================== */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-indigo-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-charcoal">Delete User Account?</h3>
              <p className="text-xs text-charcoal/60 mt-1">
                Are you sure you want to delete <strong>{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-charcoal/70 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

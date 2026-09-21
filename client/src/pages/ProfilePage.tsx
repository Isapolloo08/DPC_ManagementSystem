import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { UserActivityStats } from "../types";
import {
  User as UserIcon, Lock, Shield, BarChart3, CheckCircle2, AlertCircle,
  Eye, EyeOff, Save, KeyRound, Sparkles, Building, Phone, Mail,
  Calendar, MapPin, Briefcase, GraduationCap, Users, Heart,
  Check, ShieldCheck, Clock, BookOpen, Utensils, RefreshCw
} from "lucide-react";

type TabType = "personal" | "security" | "roles" | "activity";

export const ProfilePage: React.FC = () => {
  const { user, refreshUserData } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("personal");

  // Profile form state
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    contact_phone: "",
    birthdate: "",
    gender: "Male",
    address: "",
    occupation: "",
    hobbies: "",
    school_name: "",
    program_major: "",
    guardian_names: "",
    guardian_phone: "",
    family_details: "",
    facebook_account: ""
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Activity stats
  const [activityStats, setActivityStats] = useState<UserActivityStats | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // UI feedback states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        username: user.username || "",
        email: user.email || "",
        contact_phone: user.contact_phone || user.member?.contact_phone || "",
        birthdate: user.member?.birthdate || "",
        gender: user.member?.gender || "Male",
        address: user.member?.address || "",
        occupation: user.member?.occupation || "",
        hobbies: user.member?.hobbies || "",
        school_name: user.member?.school_name || "",
        program_major: user.member?.program_major || "",
        guardian_names: user.member?.guardian_names || "",
        guardian_phone: user.member?.guardian_phone || "",
        family_details: user.member?.family_details || "",
        facebook_account: user.member?.facebook_account || ""
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });

      loadActivity();
    }
  }, [user]);

  const loadActivity = async () => {
    try {
      setLoadingActivity(true);
      const stats = await api.getProfileActivity();
      setActivityStats(stats);
    } catch (err) {
      console.error("Failed to load activity stats:", err);
    } finally {
      setLoadingActivity(false);
    }
  };

  if (!user) return null;

  // Password strength calculation
  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 6) score += 25;
    if (pass.length >= 10) score += 25;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 25;
    return score;
  };

  const passwordStrength = calculatePasswordStrength(passwordForm.newPassword);
  const getStrengthLabel = (score: number) => {
    if (score === 0) return { label: "None", color: "bg-gray-200 text-gray-400" };
    if (score <= 25) return { label: "Weak", color: "bg-rose-500 text-white" };
    if (score <= 50) return { label: "Fair", color: "bg-amber-500 text-white" };
    if (score <= 75) return { label: "Good", color: "bg-sky-500 text-white" };
    return { label: "Strong", color: "bg-emerald-500 text-white" };
  };

  // Role details mapping
  const roleMetadata: Record<string, { badge: string; color: string; desc: string; permissions: string[] }> = {
    Admin: {
      badge: "Master Administrator",
      color: "bg-gradient-to-r from-rose-600 to-amber-600 text-white",
      desc: "Full system administration, access management, master lookups, audit logs, and church oversight.",
      permissions: [
        "Create, update, and manage all user accounts & permissions",
        "Manage 7 Age-bracket Ministries, Leaders, and Coordinators",
        "Sunday Attendance live check-ins and session management",
        "Life Groups and Discipleship curriculum books & lessons",
        "Saturday Cleaning Duty & Sunday Dishwashing rotation cycles",
        "Events calendar, announcements, and bulletins",
        "Financial records, tithes, and system audit trails"
      ]
    },
    Coordinator: {
      badge: "Ministry Coordinator",
      color: "bg-gradient-to-r from-teal-600 to-emerald-600 text-white",
      desc: "Departmental leadership for assigned age-bracket ministries, events, curriculum, and volunteer assignments.",
      permissions: [
        "Manage designated age-bracket ministry rosters & member profiles",
        "Facilitate Sunday live check-ins and age-appropriate kiosks",
        "Coordinate Discipleship topics & life group allocations",
        "Publish ministry announcements and view event schedules"
      ]
    },
    Leader: {
      badge: "Life Group Leader",
      color: "bg-gradient-to-r from-sky-600 to-indigo-600 text-white",
      desc: "Small group & Bible study leadership, member spiritual care, discipleship tracking, and fellowship.",
      permissions: [
        "Manage assigned Life Group members and discipleship roster",
        "Record weekly meeting discussions and study topics",
        "Track curriculum study progression and member spiritual milestones",
        "View church-wide events and ministry announcements"
      ]
    },
    Volunteer: {
      badge: "Ministry Volunteer",
      color: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white",
      desc: "Assists with Sunday divine service check-ins, event logistics, and member reception.",
      permissions: [
        "Operate Sunday divine worship check-in kiosks",
        "Assist attendees with barcode/QR verification",
        "View community announcements and event schedules"
      ]
    },
    Member: {
      badge: "Church Member",
      color: "bg-gradient-to-r from-indigo-700 to-slate-800 text-white",
      desc: "Covenant member and active fellowship participant in Daet Presbyterian Church.",
      permissions: [
        "Maintain personal membership card & family household profile",
        "Participate in assigned Bible study life groups",
        "View upcoming fellowships, sermons, and announcements",
        "Register for church events and workshops"
      ]
    }
  };

  const currentRoleMeta = roleMetadata[user.role_name] || {
    badge: user.role_name,
    color: "bg-indigo-600 text-white",
    desc: "Active user account with authenticated church portal access.",
    permissions: ["Access authenticated church features based on role permissions."]
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    try {
      await api.updateProfile(formData);
      setProfileSuccessMsg("Profile information updated successfully!");
      await refreshUserData();
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrorMsg("New password and confirm password do not match");
      setSavingPassword(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordErrorMsg("New password must be at least 6 characters long");
      setSavingPassword(false);
      return;
    }

    try {
      await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordSuccessMsg("Password changed successfully! Keep your credentials secure.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setTimeout(() => setPasswordSuccessMsg(null), 5000);
    } catch (err: any) {
      setPasswordErrorMsg(err.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 pb-12">
      {/* HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-white/10">
        <img
          src="/container_bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center opacity-35 mix-blend-screen pointer-events-none"
        />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            {/* User Avatar with Ring */}
            <div className="relative shrink-0">
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-200 text-indigo-950 font-black text-2xl sm:text-3xl flex items-center justify-center shadow-xl ring-4 ring-white/10">
                {initials}
              </div>
              <span className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-emerald-500 text-white shadow-md" title="Active session">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                  {user.name}
                </h1>
                <span className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-xs ${currentRoleMeta.color}`}>
                  {user.role_name}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-indigo-200/90 font-medium flex items-center gap-2 mt-1 truncate">
                <span>@{user.username || user.email.split("@")[0]}</span>
                <span>•</span>
                <span>{user.email}</span>
              </p>

              {user.ministries && user.ministries.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">
                    Assigned:
                  </span>
                  {user.ministries.map((m) => (
                    <span
                      key={m.id}
                      className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-white/15 text-white backdrop-blur-xs border border-white/20"
                    >
                      {m.name} Ministry
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={loadActivity}
              className="p-2.5 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Refresh profile details"
            >
              <RefreshCw className={`w-4 h-4 ${loadingActivity ? "animate-spin text-amber-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 mt-8 overflow-x-auto no-scrollbar pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("personal")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "personal"
                ? "bg-white text-indigo-950 shadow-md font-black scale-100"
                : "bg-white/10 hover:bg-white/15 text-white/90 hover:text-white"
            }`}
          >
            <UserIcon className="w-4 h-4 shrink-0" />
            <span>Personal & Account Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "security"
                ? "bg-white text-indigo-950 shadow-md font-black scale-100"
                : "bg-white/10 hover:bg-white/15 text-white/90 hover:text-white"
            }`}
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span>Password & Security</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "roles"
                ? "bg-white text-indigo-950 shadow-md font-black scale-100"
                : "bg-white/10 hover:bg-white/15 text-white/90 hover:text-white"
            }`}
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span>Role & Permissions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "activity"
                ? "bg-white text-indigo-950 shadow-md font-black scale-100"
                : "bg-white/10 hover:bg-white/15 text-white/90 hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>Church Engagement</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT PANELS */}
      <div className="space-y-6">
        {/* TAB 1: PERSONAL & ACCOUNT DETAILS */}
        {activeTab === "personal" && (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {profileSuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-3 shadow-2xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}
            {profileErrorMsg && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-3 shadow-2xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            {/* Core Account Credentials */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Core Account Credentials
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo font-bold text-indigo-950 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1.5">Username</label>
                  <input
                    type="text"
                    placeholder="e.g. mark.angelo"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo font-bold text-indigo-950 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo font-bold text-indigo-950 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Contact & Demographics */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Phone className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Contact & Demographics
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1.5">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 0917-123-4567"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.birthdate}
                    onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1.5">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs font-bold"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-charcoal/70 mb-1.5">Complete Home Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Brgy. Gahonon, Daet, Camarines Norte"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Academic & Professional Details */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Academic, Career & Personal Interests
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-charcoal/70 mb-1.5">Occupation / Workplace</label>
                  <input
                    type="text"
                    placeholder="e.g. Software Engineer, Teacher, Nurse, Student"
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1.5">Hobbies & Talents</label>
                  <input
                    type="text"
                    placeholder="e.g. Music, Guitar, Cooking, Sports"
                    value={formData.hobbies}
                    onChange={(e) => setFormData({ ...formData, hobbies: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1.5">College / University</label>
                  <input
                    type="text"
                    placeholder="e.g. CNSC / Mabini Colleges / SLSU"
                    value={formData.school_name}
                    onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-charcoal/70 mb-1.5">Degree Program & Major</label>
                  <input
                    type="text"
                    placeholder="e.g. BS Information Technology, BS Accountancy"
                    value={formData.program_major}
                    onChange={(e) => setFormData({ ...formData, program_major: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-indigo-950 font-black text-xs px-8 py-3 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-indigo-950" />
                <span>{savingProfile ? "Saving Changes..." : "Save Profile Changes"}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: PASSWORD & SECURITY */}
        {activeTab === "security" && (
          <form onSubmit={handlePasswordSubmit} className="max-w-2xl mx-auto space-y-6">
            {passwordSuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-3 shadow-2xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{passwordSuccessMsg}</span>
              </div>
            )}
            {passwordErrorMsg && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-3 shadow-2xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{passwordErrorMsg}</span>
              </div>
            )}

            <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-2xs space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Lock className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Update Account Password
                </h3>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1.5 text-xs">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    placeholder="Enter current password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-indigo transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1.5 text-xs">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    placeholder="Minimum 6 characters"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-indigo transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {passwordForm.newPassword && (
                  <div className="mt-2.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-gray-500">Password Strength:</span>
                      <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${getStrengthLabel(passwordStrength).color}`}>
                        {getStrengthLabel(passwordStrength).label}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          passwordStrength <= 25
                            ? "bg-rose-500 w-1/4"
                            : passwordStrength <= 50
                            ? "bg-amber-500 w-2/4"
                            : passwordStrength <= 75
                            ? "bg-sky-500 w-3/4"
                            : "bg-emerald-500 w-full"
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-charcoal/70 mb-1.5 text-xs">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Re-type new password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full bg-ivory-light/60 p-3 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo text-xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-indigo transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {passwordForm.confirmPassword && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold">
                    {passwordForm.newPassword === passwordForm.confirmPassword ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Passwords match
                      </span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> Passwords do not match
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Security Recommendations</span>
                </div>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  Always use a strong, unique password. Password updates immediately take effect across all church computers and kiosks.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-900 to-indigo-800 hover:from-indigo-800 hover:to-indigo-700 text-white font-black text-xs py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>{savingPassword ? "Updating Password..." : "Update Account Password"}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: ROLE & PERMISSIONS MATRIX */}
        {activeTab === "roles" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-charcoal/50 block">
                Assigned Role Overview
              </span>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-indigo-950">{currentRoleMeta.badge}</h2>
                <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-xs ${currentRoleMeta.color}`}>
                  {user.role_name}
                </span>
              </div>
              <p className="text-xs text-charcoal/70 leading-relaxed font-medium">
                {currentRoleMeta.desc}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Granted Privileges & Access Boundaries
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentRoleMeta.permissions.map((perm, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100/80 text-xs text-indigo-950 font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{perm}</span>
                  </div>
                ))}
              </div>
            </div>

            {user.ministries && user.ministries.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                    Authorized Ministry Departments
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {user.ministries.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-2xl bg-white border border-indigo-100 shadow-2xs flex items-center gap-3.5"
                    >
                      <span className={`w-4 h-4 rounded-full ${m.color} shrink-0`} />
                      <div>
                        <span className="text-xs font-black text-indigo-950 block">{m.name} Ministry</span>
                        <span className="text-[10px] text-charcoal/50 font-bold">Authorized Department Scope</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CHURCH ACTIVITY & STATS */}
        {activeTab === "activity" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-charcoal/50 uppercase tracking-wider block">
                    Sunday Attendance
                  </span>
                  <span className="text-xl font-black text-indigo-950">
                    {activityStats?.attendanceCount || 0} Records
                  </span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-charcoal/50 uppercase tracking-wider block">
                    Life Groups Led
                  </span>
                  <span className="text-xl font-black text-indigo-950">
                    {activityStats?.groupsLed.length || 0} Groups
                  </span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-charcoal/50 uppercase tracking-wider block">
                    Groups Attended
                  </span>
                  <span className="text-xl font-black text-indigo-950">
                    {activityStats?.groupsAttended.length || 0} Active
                  </span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-charcoal/50 uppercase tracking-wider block">
                    Duty Assignments
                  </span>
                  <span className="text-xl font-black text-indigo-950">
                    {activityStats?.dutiesAssigned.length || 0} Teams
                  </span>
                </div>
              </div>
            </div>

            {/* Life Groups Overview */}
            {activityStats?.groupsLed && activityStats.groupsLed.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <BookOpen className="w-4 h-4 text-sky-600" />
                  <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                    Life Groups You Facilitate
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {activityStats.groupsLed.map((g) => (
                    <div key={g.id} className="p-4 rounded-2xl bg-sky-50/40 border border-sky-100 space-y-1.5">
                      <span className="font-black text-sky-950 text-sm block">{g.name}</span>
                      <div className="text-xs text-sky-800/80 font-medium flex items-center gap-2">
                        <span>🗓️ {g.schedule_day} {g.schedule_time}</span>
                        {g.meeting_location && <span>• 📍 {g.meeting_location}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duty Assignments */}
            {activityStats?.dutiesAssigned && activityStats.dutiesAssigned.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Utensils className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                    Cleaning & Dishwashing Teams
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {activityStats.dutiesAssigned.map((d, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-amber-50/40 border border-amber-100 space-y-1.5">
                      <span className="font-black text-amber-950 text-sm block">{d.team_name}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-md font-bold inline-block">
                        {d.duty_role || "Team Member"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

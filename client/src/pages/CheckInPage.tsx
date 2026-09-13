import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { ChurchLogo } from "../components/common/ChurchLogo";
import { api } from "../api";
import { Member, AttendanceRecord, Ministry, AttendanceRosterItem } from "../types";
import { 
  UserCheck, ShieldCheck, Tag, AlertCircle, 
  Search, CheckCircle2, Clock, Printer, KeyRound, QrCode, X,
  Users, Sparkles, Heart, Check, Calendar, Plus, RefreshCw,
  Home, Phone, UserPlus, Filter, ArrowRight, ShieldAlert, Award,
  UserX, HelpCircle, XCircle, RotateCcw, FileText, CheckSquare
} from "lucide-react";
import { DatePickerInput } from "../components/common/DatePickerInput";
import { useSocketEvent } from "../socket";
import { CheckInPageSkeleton, TableSkeleton } from "../components/common/SkeletonLoader";

export const CheckInPage: React.FC = () => {
  const { user, ministries, allowedMinistries, isRestricted, selectedMinistryId } = useAuth();
  const coordinatorMinistryId = isRestricted && allowedMinistries.length > 0
    ? allowedMinistries[0].id
    : (user?.role_name !== "Admin" && selectedMinistryId ? selectedMinistryId : null);
  
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [serviceName, setServiceName] = useState<string>("Sunday Morning Divine Worship (9:30 AM)");
  const [filterMinistry, setFilterMinistry] = useState<string>(
    coordinatorMinistryId ? String(coordinatorMinistryId) : (selectedMinistryId ? String(selectedMinistryId) : "all")
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent" | "excused" | "kids_checked_in" | "unmarked">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHousehold, setSelectedHousehold] = useState<string>("all");

  useEffect(() => {
    if (coordinatorMinistryId) {
      setFilterMinistry(String(coordinatorMinistryId));
    }
  }, [coordinatorMinistryId]);

  // Roster & Attendance Data
  const [roster, setRoster] = useState<AttendanceRosterItem[]>([]);
  const [activeCheckins, setActiveCheckins] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  // Security Tag / Badge Modal
  const [issuedBadge, setIssuedBadge] = useState<{
    security_code: string | null;
    member_name: string;
    ministry_name: string;
    medical_notes: string | null;
    checked_in_at: string;
  } | null>(null);

  // Check-out modal state
  const [checkoutRecord, setCheckoutRecord] = useState<AttendanceRecord | AttendanceRosterItem | null>(null);
  const [checkoutCodeInput, setCheckoutCodeInput] = useState("");
  const [checkoutError, setCheckoutError] = useState("");

  // Mark Absent / Excused Modal
  const [absentModalMember, setAbsentModalMember] = useState<AttendanceRosterItem | null>(null);
  const [absentStatusType, setAbsentStatusType] = useState<"absent" | "excused">("absent");
  const [absentPresetReason, setAbsentPresetReason] = useState<string>("Sick / Not Feeling Well");
  const [absentCustomNotes, setAbsentCustomNotes] = useState<string>("");

  // Quick Guest Registration Modal
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestBirthdate, setGuestBirthdate] = useState("2000-01-01");
  const [guestMinistryId, setGuestMinistryId] = useState<number>(1);
  const [guestPhone, setGuestPhone] = useState("");
  const [guestNotes, setGuestNotes] = useState("");

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    loadAttendanceData(roster.length === 0);
  }, [serviceDate]);

  // Real-time automatic sync via Socket.IO
  useSocketEvent("attendance:changed", () => {
    loadAttendanceData(false);
  }, [serviceDate]);

  useSocketEvent("members:changed", () => {
    loadAttendanceData(false);
  }, [serviceDate]);

  useSocketEvent("ministries:changed", () => {
    loadAttendanceData(false);
  }, [serviceDate]);

  const loadAttendanceData = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      const ministryParam = coordinatorMinistryId ? coordinatorMinistryId : undefined;
      const [rosterList, checkinsList] = await Promise.all([
        api.getAttendanceRoster({ ministry_id: ministryParam, date: serviceDate }).catch(() => []),
        api.getTodayAttendance(ministryParam, serviceDate).catch(() => [])
      ]);
      setRoster(rosterList);
      setActiveCheckins(checkinsList);
    } catch (err: any) {
      console.error("Failed to load attendance data:", err);
      showToast(err.message || "Failed to load attendance", "error");
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  // Mark single member present
  const handleMarkPresent = async (item: AttendanceRosterItem) => {
    try {
      setActionLoading(item.member_id);
      const res = await api.checkIn({
        member_id: item.member_id,
        ministry_id: item.ministry_id,
        service_name: serviceName,
        status: "present",
        target_date: serviceDate,
        notes: `Sunday Service check-in by ${user?.name || "Usher"}`
      });

      if (res.security_code) {
        setIssuedBadge({
          security_code: res.security_code,
          member_name: res.member_name,
          ministry_name: res.ministry_name,
          medical_notes: res.medical_notes,
          checked_in_at: res.checked_in_at
        });
      }

      showToast(`✓ ${item.first_name} ${item.last_name} marked present!`);
      loadAttendanceData();
    } catch (err: any) {
      showToast(err.message || "Failed to mark present", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Mark single member absent directly or open modal
  const handleOpenAbsentModal = (item: AttendanceRosterItem, type: "absent" | "excused" = "absent") => {
    setAbsentModalMember(item);
    setAbsentStatusType(type);
    setAbsentPresetReason(type === "absent" ? "Unexcused / No Show" : "Sick / Not Feeling Well");
    setAbsentCustomNotes("");
  };

  // Quick mark absent without dialog
  const handleQuickMarkAbsent = async (item: AttendanceRosterItem) => {
    try {
      setActionLoading(item.member_id);
      await api.checkIn({
        member_id: item.member_id,
        ministry_id: item.ministry_id,
        service_name: serviceName,
        status: "absent",
        reason: "Absent today",
        target_date: serviceDate
      });
      showToast(`Marked ${item.first_name} ${item.last_name} absent today`);
      loadAttendanceData();
    } catch (err: any) {
      showToast(err.message || "Failed to mark absent", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Save absent or excused from modal
  const handleSaveAbsentOrExcused = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!absentModalMember) return;
    try {
      setActionLoading(absentModalMember.member_id);
      const combinedReason = [absentPresetReason, absentCustomNotes.trim()].filter(Boolean).join(" — ");
      await api.checkIn({
        member_id: absentModalMember.member_id,
        ministry_id: absentModalMember.ministry_id,
        service_name: serviceName,
        status: absentStatusType,
        reason: combinedReason,
        target_date: serviceDate
      });

      showToast(`✓ ${absentModalMember.first_name} marked as ${absentStatusType === "absent" ? "Absent" : "Excused"} today!`);
      setAbsentModalMember(null);
      setAbsentCustomNotes("");
      loadAttendanceData();
    } catch (err: any) {
      showToast(err.message || `Failed to mark ${absentStatusType}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Undo / Unmark attendance
  const handleUndoAttendance = async (item: AttendanceRosterItem) => {
    if (!item.attendance_id) return;
    try {
      setActionLoading(item.member_id);
      await api.undoCheckIn(item.attendance_id);
      showToast(`Removed attendance mark for ${item.first_name}`);
      loadAttendanceData();
    } catch (err: any) {
      showToast(err.message || "Failed to undo attendance", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Check in entire household at once
  const handleCheckInHousehold = async (householdName: string, memberIds: number[]) => {
    try {
      await api.batchCheckIn({
        member_ids: memberIds,
        service_name: `${serviceName} (Household: ${householdName})`
      });
      showToast(`✓ Checked in all ${memberIds.length} members of the ${householdName} family!`);
      loadAttendanceData(false);
    } catch (err: any) {
      showToast(err.message || "Failed to check in household", "error");
    }
  };

  // Quick Guest check-in
  const handleCreateAndCheckInGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestFirstName.trim() || !guestLastName.trim()) {
      showToast("First and last name are required", "error");
      return;
    }

    try {
      setGuestSubmitting(true);
      const newMember = await api.createMember({
        first_name: guestFirstName.trim(),
        last_name: guestLastName.trim(),
        birthdate: guestBirthdate,
        ministry_id: guestMinistryId,
        contact_phone: guestPhone.trim() || undefined,
        status: "visitor"
      });

      await api.checkIn({
        member_id: newMember.id,
        ministry_id: guestMinistryId,
        service_name: serviceName,
        status: "present",
        target_date: serviceDate,
        notes: `Sunday Guest Check-In: ${guestNotes || "First-time visitor"}`
      });

      showToast(`✓ Registered & checked in guest ${guestFirstName} ${guestLastName}!`);
      setIsGuestModalOpen(false);
      setGuestFirstName("");
      setGuestLastName("");
      setGuestNotes("");
      loadAttendanceData(false);
    } catch (err: any) {
      showToast(err.message || "Failed to check in guest", "error");
    } finally {
      setGuestSubmitting(false);
    }
  };

  // Check-out with code
  const handlePerformCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutRecord) return;

    try {
      setCheckoutSubmitting(true);
      setCheckoutError("");
      const attendanceId = ("attendance_id" in checkoutRecord ? checkoutRecord.attendance_id : checkoutRecord.id) || undefined;
      await api.checkOut({
        attendance_id: attendanceId,
        member_id: checkoutRecord.member_id,
        security_code: checkoutCodeInput
      });

      showToast(`✓ ${checkoutRecord.first_name} checked out safely!`);
      setCheckoutRecord(null);
      setCheckoutCodeInput("");
      loadAttendanceData(false);
    } catch (err: any) {
      setCheckoutError(err.message || "Security code verification failed");
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  // Direct In-Person Verification Check-Out (Bypass tag)
  const handleDirectCheckout = async (record: AttendanceRecord | AttendanceRosterItem) => {
    try {
      setActionLoading(record.member_id);
      const attendanceId = ("attendance_id" in record ? record.attendance_id : record.id) || undefined;
      await api.checkOut({
        attendance_id: attendanceId,
        member_id: record.member_id,
        force: true
      });
      showToast(`✓ ${record.first_name} checked out safely by usher verification!`);
      setCheckoutRecord(null);
      setCheckoutCodeInput("");
      loadAttendanceData(false);
    } catch (err: any) {
      showToast(err.message || "Checkout failed", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const isMinorMinistry = (mName?: string) => mName === "Kinder" || mName === "Elementary";

  // Filtered Roster Items
  const filteredRoster = useMemo(() => {
    return roster.filter(item => {
      if (coordinatorMinistryId && item.ministry_id !== coordinatorMinistryId) {
        return false;
      }
      if (filterMinistry !== "all" && String(item.ministry_id) !== filterMinistry) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        `${item.first_name} ${item.last_name}`.toLowerCase().includes(q) ||
        (item.household_name && item.household_name.toLowerCase().includes(q)) ||
        (item.parent_phone && item.parent_phone.includes(q)) ||
        (item.security_code && item.security_code.toLowerCase().includes(q));

      const matchesHousehold = selectedHousehold === "all" || item.household_name === selectedHousehold;

      // Status resolution
      const isPresent = item.is_present === 1;
      const isAbsent = item.attendance_status === "absent" || item.attendance_notes?.includes("[ABSENT]");
      const isExcused = item.attendance_status === "excused" || item.attendance_notes?.includes("[EXCUSED]");
      const isKidInSchool = isMinorMinistry(item.ministry_name) && isPresent && !item.checked_out_at;
      const isUnmarked = !isPresent && !isAbsent && !isExcused;

      let matchesStatus = true;
      if (statusFilter === "present") matchesStatus = isPresent;
      else if (statusFilter === "absent") matchesStatus = !!isAbsent;
      else if (statusFilter === "excused") matchesStatus = !!isExcused;
      else if (statusFilter === "kids_checked_in") matchesStatus = isKidInSchool;
      else if (statusFilter === "unmarked") matchesStatus = isUnmarked;

      return matchesSearch && matchesHousehold && matchesStatus;
    });
  }, [roster, searchQuery, selectedHousehold, coordinatorMinistryId, filterMinistry, statusFilter]);

  // Households list
  const householdsList = useMemo(() => {
    const names = new Set<string>();
    roster.forEach(r => {
      if (r.household_name) names.add(r.household_name);
    });
    return Array.from(names).sort();
  }, [roster]);

  // Statistics
  const totalRosterCount = roster.length;
  const presentCount = roster.filter(r => r.is_present === 1).length;
  const absentCount = roster.filter(r => r.attendance_status === "absent" || r.attendance_notes?.includes("[ABSENT]")).length;
  const excusedCount = roster.filter(r => r.attendance_status === "excused" || r.attendance_notes?.includes("[EXCUSED]")).length;
  const attendanceRate = totalRosterCount > 0 ? Math.round((presentCount / totalRosterCount) * 100) : 0;
  
  const kidsCheckedIn = roster.filter(r => isMinorMinistry(r.ministry_name) && r.is_present === 1 && !r.checked_out_at);
  const checkedOutCount = roster.filter(r => isMinorMinistry(r.ministry_name) && r.checked_out_at !== null).length;
  const unmarkedCount = totalRosterCount - presentCount - absentCount - excusedCount;

  if (loading && roster.length === 0) {
    return <CheckInPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      
      {/* Toast Banner */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold text-white border animate-in slide-in-from-bottom-4 ${
          toastMsg.type === "success" ? "bg-emerald-900 border-emerald-700" : "bg-rose-900 border-rose-700"
        }`}>
          {toastMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* TOP HERO: Sunday Service & Attendance Overview */}
      <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-radial from-amber-500/15 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-amber-300 text-[11px] font-bold shadow-2xs backdrop-blur-md">
              <ChurchLogo className="w-3.5 h-3.5 text-amber-400" />
              <span>Sunday Divine Worship & Kids Attendance Kiosk</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Worship Service Attendance
            </h1>
            <p className="text-xs text-indigo-200/90 max-w-xl leading-relaxed">
              Track Sunday attendees, mark kids check-in / check-out, record absent & excused members, and generate child security badges.
            </p>
          </div>

          {/* Quick Date & Service Selector Controls */}
          <div className="flex flex-wrap items-center gap-2.5 bg-white/10 p-2.5 rounded-2xl border border-white/15 backdrop-blur-md">
            <div className="w-44">
              <DatePickerInput
                value={serviceDate}
                onChange={(val) => setServiceDate(val)}
                dark
                placeholder="Select service date"
              />
            </div>

            <button
              onClick={() => setIsGuestModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber to-amber-500 hover:from-amber-500 hover:to-amber-600 text-charcoal font-black text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Check In Guest</span>
            </button>

            <button
              onClick={() => loadAttendanceData(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title="Refresh Attendance"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Live Attendance Metric Stat Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Present Today</span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {presentCount} <span className="text-xs font-normal text-indigo-300">/ {totalRosterCount}</span>
            </div>
            <div className="text-[10px] text-emerald-300 font-bold mt-0.5">{attendanceRate}% Turnout</div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Absent / Excused</span>
              <UserX className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {absentCount + excusedCount}
            </div>
            <div className="text-[10px] text-rose-300 mt-0.5">
              {absentCount} Absent • {excusedCount} Excused
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Kids In Sunday School</span>
              <Tag className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {kidsCheckedIn.length}
            </div>
            <div className="text-[10px] text-indigo-200 mt-0.5">Kinder & Elementary in session</div>
          </div>

          <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">Kids Checked Out</span>
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {checkedOutCount}
            </div>
            <div className="text-[10px] text-indigo-200 mt-0.5">Safe pickup verified</div>
          </div>
        </div>
      </div>

      {/* VIEW SWITCHER TABS & SEARCH FILTERS */}
      <div className="space-y-3 bg-white p-4 rounded-3xl border border-gray-200 shadow-2xs">
        
        {/* Ministry Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {coordinatorMinistryId ? (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{user?.ministries && user.ministries.length > 0 ? user.ministries[0].name : "Youth"} Ministry Attendance</span>
              <span className="text-[10px] text-indigo-600 font-semibold">(Assigned Scope)</span>
            </div>
          ) : (
            <>
              {!isRestricted && (
                <button
                  onClick={() => setFilterMinistry("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    filterMinistry === "all"
                      ? "bg-indigo text-white shadow-xs"
                      : "bg-gray-100 hover:bg-gray-200 text-charcoal/80"
                  }`}
                >
                  All Church ({totalRosterCount})
                </button>
              )}
              {allowedMinistries.map(m => {
                const countForMin = roster.filter(r => r.ministry_id === m.id).length;
                const presentForMin = roster.filter(r => r.ministry_id === m.id && r.is_present === 1).length;
                const isSelected = filterMinistry === String(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => setFilterMinistry(String(m.id))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-indigo text-white shadow-xs"
                        : "bg-gray-100 hover:bg-gray-200 text-charcoal/80"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color || "#2C3968" }}></span>
                    <span>{m.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? "bg-white/20 text-white" : "bg-white text-charcoal/70 shadow-2xs"}`}>
                      {presentForMin}/{countForMin}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Secondary Bar: Status Filter Pills + Search Input + Household Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-gray-100">
          
          {/* Status Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs">
            <span className="text-[11px] font-black text-charcoal/50 uppercase tracking-wider shrink-0 mr-1">Status:</span>
            
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 cursor-pointer ${
                statusFilter === "all"
                  ? "bg-charcoal text-white shadow-xs"
                  : "bg-gray-100 hover:bg-gray-200 text-charcoal/70"
              }`}
            >
              All ({totalRosterCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("present")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                statusFilter === "present"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Present ({presentCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("absent")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                statusFilter === "absent"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
              }`}
            >
              <UserX className="w-3 h-3" />
              <span>Absent ({absentCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("excused")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                statusFilter === "excused"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              <HelpCircle className="w-3 h-3" />
              <span>Excused ({excusedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("kids_checked_in")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                statusFilter === "kids_checked_in"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200"
              }`}
            >
              <Tag className="w-3 h-3" />
              <span>Kids in Sunday School ({kidsCheckedIn.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("unmarked")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all shrink-0 cursor-pointer ${
                statusFilter === "unmarked"
                  ? "bg-gray-600 text-white shadow-xs"
                  : "bg-gray-100 hover:bg-gray-200 text-charcoal/60"
              }`}
            >
              Unmarked ({unmarkedCount})
            </button>
          </div>

          {/* Search & Household Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-charcoal/40 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search member, family, tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-indigo/20 focus:border-indigo outline-none"
              />
            </div>

            <select
              value={selectedHousehold}
              onChange={(e) => setSelectedHousehold(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs bg-white text-charcoal/80 focus:ring-2 focus:ring-indigo/20 outline-none font-medium cursor-pointer"
            >
              <option value="all">All Households</option>
              {householdsList.map(h => (
                <option key={h} value={h}>{h} Family</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MAIN ATTENDANCE ROSTER LIST */}
      {loading && roster.length === 0 ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-base text-charcoal flex items-center gap-2">
                  <span>Sunday Service Attendance Directory</span>
                  <span className="text-xs font-normal text-charcoal/50">({filteredRoster.length} members shown)</span>
                </h2>
                <p className="text-[11px] text-charcoal/50">
                  Quickly mark attendance: Check-In (Present), Check-Out, Absent Today, or Excused (Sick/Travel).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                {presentCount} Present
              </span>
              <span className="text-xs font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
                {absentCount} Absent
              </span>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                {excusedCount} Excused
              </span>
            </div>
          </div>

          {/* Roster Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-charcoal/60 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Member / Child Name</th>
                  <th className="py-3 px-4">Ministry</th>
                  <th className="py-3 px-4">Household / Family</th>
                  <th className="py-3 px-4">Security Tag</th>
                  <th className="py-3 px-4">Attendance Status</th>
                  <th className="py-3 px-4 text-right">Attendance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
              {filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-charcoal/50">
                    <AlertCircle className="w-8 h-8 text-charcoal/30 mx-auto mb-2" />
                    <p className="font-bold text-xs">No members found matching your search and filter criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredRoster.map((item) => {
                  const isPresent = item.is_present === 1;
                  const isAbsent = item.attendance_status === "absent" || item.attendance_notes?.includes("[ABSENT]");
                  const isExcused = item.attendance_status === "excused" || item.attendance_notes?.includes("[EXCUSED]");
                  const isChecking = actionLoading === item.member_id;
                  const isMinor = isMinorMinistry(item.ministry_name);
                  const isCheckedOut = isMinor && !!item.checked_out_at;

                  return (
                    <tr key={item.member_id} className={`hover:bg-indigo-50/20 transition-colors ${
                      isPresent ? "bg-emerald-50/30" : isAbsent ? "bg-rose-50/30" : isExcused ? "bg-amber-50/30" : ""
                    }`}>
                      {/* Member Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border shrink-0 ${
                            isPresent 
                              ? "bg-emerald-100 text-emerald-900 border-emerald-300" 
                              : isAbsent
                              ? "bg-rose-100 text-rose-900 border-rose-300"
                              : isExcused
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : "bg-gray-100 text-charcoal/70 border-gray-200"
                          }`}>
                            {item.first_name[0]}{item.last_name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-charcoal flex items-center gap-1.5">
                              <span>{item.first_name} {item.last_name}</span>
                              {item.member_status === "Visitor" && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  GUEST
                                </span>
                              )}
                            </div>
                            {item.medical_notes && (
                              <p className="text-[10px] text-rose-600 font-semibold truncate max-w-xs">
                                ⚠️ {item.medical_notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Ministry */}
                      <td className="py-3.5 px-4">
                        <span 
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-2xs inline-block"
                          style={{ backgroundColor: item.ministry_color || "#2C3968" }}
                        >
                          {item.ministry_name}
                        </span>
                      </td>

                      {/* Household */}
                      <td className="py-3.5 px-4">
                        {item.household_name ? (
                          <div className="flex items-center gap-1.5">
                            <Home className="w-3.5 h-3.5 text-charcoal/40 shrink-0" />
                            <span className="font-bold text-charcoal">{item.household_name} Family</span>
                          </div>
                        ) : (
                          <span className="text-charcoal/40 italic text-[11px]">Individual</span>
                        )}
                      </td>

                      {/* Security Tag */}
                      <td className="py-3.5 px-4">
                        {item.security_code ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIssuedBadge({
                                security_code: item.security_code,
                                member_name: `${item.first_name} ${item.last_name}`,
                                ministry_name: item.ministry_name,
                                medical_notes: item.medical_notes || null,
                                checked_in_at: item.checked_in_at || new Date().toISOString()
                              });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-mono font-black text-[11px] shadow-2xs cursor-pointer transition-colors"
                            title="Click to view & reprint security badge"
                          >
                            <Tag className="w-3 h-3 text-amber-600" />
                            <span>{item.security_code}</span>
                          </button>
                        ) : isMinor ? (
                          <span className="text-[10px] text-charcoal/40 italic">Generated on check-in</span>
                        ) : (
                          <span className="text-[10px] text-charcoal/40">—</span>
                        )}
                      </td>

                      {/* Status & Time */}
                      <td className="py-3.5 px-4">
                        {isPresent ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                <span>Present</span>
                              </span>
                              {isCheckedOut && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-100 text-sky-950 border border-sky-300 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-sky-700" />
                                  <span>Checked Out</span>
                                </span>
                              )}
                            </div>
                            {item.checked_in_at && (
                              <p className="text-[10px] text-charcoal/50 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-charcoal/40" />
                                In: {new Date(item.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                {item.checked_out_at && ` • Out: ${new Date(item.checked_out_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                              </p>
                            )}
                          </div>
                        ) : isAbsent ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-950 border border-rose-300 inline-flex items-center gap-1">
                              <UserX className="w-3 h-3 text-rose-700" />
                              <span>Absent Today</span>
                            </span>
                            {item.attendance_notes && (
                              <p className="text-[10px] text-rose-800 font-medium truncate max-w-xs">
                                {item.attendance_notes.replace("[ABSENT]", "").trim()}
                              </p>
                            )}
                          </div>
                        ) : isExcused ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-300 inline-flex items-center gap-1">
                              <HelpCircle className="w-3 h-3 text-amber-700" />
                              <span>Excused</span>
                            </span>
                            {item.attendance_notes && (
                              <p className="text-[10px] text-amber-800 font-medium truncate max-w-xs">
                                {item.attendance_notes.replace("[EXCUSED]", "").trim()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-charcoal/60">
                            Unmarked
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          
                          {/* When Present */}
                          {isPresent ? (
                            <>
                              {/* Checkout button for minors if not yet checked out */}
                              {isMinor && !item.checked_out_at && (
                                <button
                                  onClick={() => {
                                    setCheckoutRecord(item);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-black shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                  title="Perform safe child release / check out"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  <span>Check Out</span>
                                </button>
                              )}

                              {/* Undo present / change status button */}
                              <button
                                onClick={() => handleUndoAttendance(item)}
                                disabled={isChecking}
                                className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-rose-50 hover:text-rose-700 text-charcoal/70 text-xs font-bold transition-all cursor-pointer"
                                title="Undo attendance mark"
                              >
                                <span>Undo</span>
                              </button>
                            </>
                          ) : isAbsent || isExcused ? (
                            <>
                              {/* If marked absent/excused, option to switch to present if arrived */}
                              <button
                                onClick={() => handleMarkPresent(item)}
                                disabled={isChecking}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Mark Present</span>
                              </button>

                              <button
                                onClick={() => handleUndoAttendance(item)}
                                disabled={isChecking}
                                className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-charcoal/70 text-xs font-bold transition-all cursor-pointer"
                                title="Undo mark"
                              >
                                Undo
                              </button>
                            </>
                          ) : (
                            /* When Unmarked */
                            <div className="flex items-center gap-1">
                              {/* 1. Mark Present */}
                              <button
                                onClick={() => handleMarkPresent(item)}
                                disabled={isChecking}
                                className="px-3 py-1.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-black shadow-2xs hover:shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5 text-amber-300" />
                                <span>{isMinor ? "Check In" : "Present"}</span>
                              </button>

                              {/* 2. Quick Mark Absent */}
                              <button
                                onClick={() => handleQuickMarkAbsent(item)}
                                disabled={isChecking}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                                title="Quick mark as Absent today"
                              >
                                <UserX className="w-3 h-3" />
                                <span>Absent</span>
                              </button>

                              {/* 3. Mark Excused with Reason */}
                              <button
                                onClick={() => handleOpenAbsentModal(item, "excused")}
                                disabled={isChecking}
                                className="px-2 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all cursor-pointer"
                                title="Mark as Excused (Sick, Out of Town, etc.)"
                              >
                                <span>Excused...</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* MODAL: MARK ABSENT / EXCUSED WITH REASON */}
      {absentModalMember && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 border border-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold ${
                  absentStatusType === "absent" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {absentStatusType === "absent" ? <UserX className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-sm text-charcoal">
                    Mark {absentStatusType === "absent" ? "Absent" : "Excused"} Today
                  </h3>
                  <p className="text-[11px] text-charcoal/50">
                    {absentModalMember.first_name} {absentModalMember.last_name} • {absentModalMember.ministry_name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setAbsentModalMember(null)}
                className="p-1 text-charcoal/40 hover:text-charcoal cursor-pointer rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Switcher: Absent vs Excused */}
            <div className="p-1 bg-gray-100 rounded-xl flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAbsentStatusType("absent")}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  absentStatusType === "absent" ? "bg-white text-rose-700 shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                }`}
              >
                🔴 Mark Absent
              </button>
              <button
                type="button"
                onClick={() => setAbsentStatusType("excused")}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  absentStatusType === "excused" ? "bg-white text-amber-800 shadow-2xs" : "text-charcoal/60 hover:text-charcoal"
                }`}
              >
                🟡 Mark Excused
              </button>
            </div>

            <form onSubmit={handleSaveAbsentOrExcused} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-charcoal/80 mb-1.5">Preset Reason / Notice:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Sick / Not Feeling Well",
                    "Out of Town / Traveling",
                    "Family Event / Obligation",
                    "School / Exam Review",
                    "Transportation / Weather",
                    "Unexcused / No Notice"
                  ].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setAbsentPresetReason(reason)}
                      className={`p-2 rounded-xl text-[11px] font-bold text-left border transition-all cursor-pointer ${
                        absentPresetReason === reason
                          ? "bg-indigo-50 border-indigo-400 text-indigo-950 ring-1 ring-indigo-400"
                          : "bg-white border-gray-200 text-charcoal/80 hover:bg-gray-50"
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal/80 mb-1">Additional Notes (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Advised by mother Maria Santos"
                  value={absentCustomNotes}
                  onChange={(e) => setAbsentCustomNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-indigo"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAbsentModalMember(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-black shadow-md transition-all cursor-pointer ${
                    absentStatusType === "absent" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  Confirm {absentStatusType === "absent" ? "Absent" : "Excused"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* QUICK GUEST CHECK-IN MODAL */}
      {isGuestModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-charcoal">Quick Guest / Visitor Check-In</h3>
                  <p className="text-[11px] text-charcoal/50">Register first-time attendee for Sunday Service</p>
                </div>
              </div>
              <button onClick={() => setIsGuestModalOpen(false)} className="p-1.5 text-charcoal/40 hover:text-charcoal rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAndCheckInGuest} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-charcoal mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John"
                    value={guestFirstName}
                    onChange={(e) => setGuestFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                  />
                </div>
                <div>
                  <label className="block font-bold text-charcoal mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Doe"
                    value={guestLastName}
                    onChange={(e) => setGuestLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Ministry Assignment *</label>
                <select
                  value={guestMinistryId}
                  onChange={(e) => setGuestMinistryId(Number(e.target.value))}
                  disabled={isRestricted && allowedMinistries.length <= 1}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo bg-white disabled:opacity-90 disabled:cursor-not-allowed"
                >
                  {allowedMinistries.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.min_age || 0} - {m.max_age || "adult"} yrs)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Contact Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="+63 912 345 6789"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                />
              </div>

              <div>
                <label className="block font-bold text-charcoal mb-1">Notes / Invited By</label>
                <input
                  type="text"
                  placeholder="e.g. Invited by Santos Family"
                  value={guestNotes}
                  onChange={(e) => setGuestNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-medium text-xs outline-none focus:border-indigo"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsGuestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={guestSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5 text-amber-300" />
                  <span>{guestSubmitting ? "Registering..." : "Register & Mark Present"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* PRINTABLE SECURITY TAG MODAL (Kinder & Elementary) */}
      {issuedBadge && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-7 h-7 text-amber-600" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Sunday Minor Security Tag
              </span>
              <h3 className="text-xl font-black text-charcoal mt-1">{issuedBadge.member_name}</h3>
              <p className="text-xs text-charcoal/60 font-semibold">{issuedBadge.ministry_name}</p>
            </div>

            {/* Claim Tag Box */}
            <div className="p-4 rounded-2xl bg-indigo-950 text-white space-y-1 shadow-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Parent Claim Code</span>
              <div className="text-3xl font-black font-mono tracking-widest text-amber-400">
                {issuedBadge.security_code}
              </div>
              <p className="text-[10px] text-indigo-200">Keep this code to safely claim your child after service</p>
            </div>

            {issuedBadge.medical_notes && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs text-left">
                <span className="font-bold">Medical Alert:</span> {issuedBadge.medical_notes}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-charcoal hover:bg-gray-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Tag</span>
              </button>
              <button
                onClick={() => setIssuedBadge(null)}
                className="flex-1 py-2.5 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CHECK-OUT SECURITY CODE MODAL */}
      {checkoutRecord && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo" />
                <div>
                  <h3 className="font-bold text-sm text-charcoal">Child Pickup & Check-Out</h3>
                  <p className="text-[10px] text-charcoal/50">Verify claim code or confirm in-person release</p>
                </div>
              </div>
              <button onClick={() => { setCheckoutRecord(null); setCheckoutError(""); }} className="p-1 text-charcoal/40 hover:text-charcoal cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-xs text-indigo-950 space-y-1">
              <p>
                Child: <strong className="font-black text-indigo-950">{checkoutRecord.first_name} {checkoutRecord.last_name}</strong>
              </p>
              {"household_name" in checkoutRecord && checkoutRecord.household_name && (
                <p className="text-[11px] text-charcoal/60">Family: {checkoutRecord.household_name} Family</p>
              )}
            </div>

            {checkoutError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
                {checkoutError}
              </div>
            )}

            <form onSubmit={handlePerformCheckout} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-charcoal/70 mb-1">Enter Matching Parent Security Code:</label>
                <input
                  type="text"
                  placeholder="e.g. KND-7482"
                  value={checkoutCodeInput}
                  onChange={(e) => setCheckoutCodeInput(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-center font-mono font-bold text-base uppercase tracking-wider outline-none focus:border-indigo"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCheckoutRecord(null); setCheckoutError(""); }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkoutSubmitting}
                  className="flex-1 py-2 rounded-xl bg-indigo hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {checkoutSubmitting ? "Verifying..." : "Verify Code"}
                </button>
              </div>
            </form>

            {/* In-Person Direct Release Override Button */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleDirectCheckout(checkoutRecord)}
                className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                title="Use if parent is physically recognized without code"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Parent In-Person Present (Direct Release)</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
